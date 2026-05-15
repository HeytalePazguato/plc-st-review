import { describe, expect, it } from 'vitest';
import {
  loadGitHubPrSnapshot,
  postGitHubReview,
  resolveGitHubOptionsFromEnv,
  type GitHubApi,
  type GitHubOptions,
  type GitHubPostOptions,
  type IssueComment,
  type PrContext,
  type ReviewComment,
} from '../../src/platforms/github.js';
import type { Finding } from '../../src/engine/types.js';

interface FakeState {
  context: PrContext;
  files: Map<string, string>; // `${ref}::${path}` -> source
  reviewComments: ReviewComment[];
  issueComments: IssueComment[];
  log: Array<
    | { kind: 'create'; body: string; path: string; line: number; commitId: string }
    | {
        kind: 'createReview';
        commitId: string;
        body: string | undefined;
        comments: ReadonlyArray<{ path: string; line: number; body: string }>;
      }
    | { kind: 'update'; id: number; body: string }
    | { kind: 'delete'; id: number }
    | { kind: 'createIssue'; body: string }
    | { kind: 'updateIssue'; id: number; body: string }
  >;
}

function fakeApi(state: FakeState): GitHubApi {
  return {
    async fetchPrContext() {
      return state.context;
    },
    async fetchFile(ref, path) {
      return state.files.get(`${ref}::${path}`) ?? null;
    },
    async listStFiles(ref) {
      const out: string[] = [];
      for (const key of state.files.keys()) {
        const [keyRef, path] = key.split('::', 2);
        if (keyRef === ref && (path.endsWith('.st') || path.endsWith('.ST'))) {
          out.push(path);
        }
      }
      return out;
    },
    async listReviewComments() {
      return state.reviewComments.map((c) => ({ ...c }));
    },
    async listIssueComments() {
      return state.issueComments.map((c) => ({ ...c }));
    },
    async createReviewComment(args) {
      state.log.push({
        kind: 'create',
        body: args.body,
        path: args.path,
        line: args.line,
        commitId: args.commitId,
      });
    },
    async createReview(args) {
      state.log.push({
        kind: 'createReview',
        commitId: args.commitId,
        body: args.body,
        comments: args.comments.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
      });
    },
    async updateReviewComment(id, body) {
      state.log.push({ kind: 'update', id, body });
    },
    async deleteReviewComment(id) {
      state.log.push({ kind: 'delete', id });
    },
    async createIssueComment(body) {
      state.log.push({ kind: 'createIssue', body });
    },
    async updateIssueComment(id, body) {
      state.log.push({ kind: 'updateIssue', id, body });
    },
  };
}

const baseContext: PrContext = {
  baseSha: 'aaaa',
  headSha: 'bbbb',
  baseRef: 'main',
  headRef: 'feature/x',
  changes: [],
};

/**
 * Build a fake unified-diff patch whose hunk spans line `from` to `from+lines-1`
 * on the new side, all marked as additions. Used by tests to make the engine
 * treat specific (file, line) pairs as in-diff.
 */
function patchForLines(from: number, lines: number): string {
  const header = `@@ -${from},${lines} +${from},${lines} @@`;
  const adds = Array.from({ length: lines }, (_, i) => `+line ${from + i}`).join('\n');
  return `${header}\n${adds}`;
}

function ctxWithDiff(file: string, lineStart: number, lineCount = 20): PrContext {
  return {
    ...baseContext,
    changes: [
      {
        oldPath: file,
        newPath: file,
        renamed: false,
        removed: false,
        added: false,
        patch: patchForLines(lineStart, lineCount),
      },
    ],
  };
}

const opts: GitHubOptions = {
  token: 'x',
  owner: 'octo',
  repo: 'plc',
  pullNumber: 7,
};

describe('resolveGitHubOptionsFromEnv', () => {
  it('parses GITHUB_REPOSITORY', () => {
    process.env.GITHUB_TOKEN = 't';
    process.env.GITHUB_REPOSITORY = 'octo/plc';
    const out = resolveGitHubOptionsFromEnv({ pullNumber: 7 });
    expect(out.owner).toBe('octo');
    expect(out.repo).toBe('plc');
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
  });

  it('throws when token missing', () => {
    delete process.env.GITHUB_TOKEN;
    expect(() => resolveGitHubOptionsFromEnv({ pullNumber: 7, owner: 'o', repo: 'r' })).toThrow(
      /GITHUB_TOKEN/,
    );
  });
});

describe('loadGitHubPrSnapshot', () => {
  it('filters to .st files and fetches both revisions', async () => {
    const state: FakeState = {
      context: {
        ...baseContext,
        changes: [
          { oldPath: 'a.st', newPath: 'a.st', renamed: false, removed: false, added: false },
          { oldPath: 'README.md', newPath: 'README.md', renamed: false, removed: false, added: false },
          { oldPath: 'new.st', newPath: 'new.st', renamed: false, removed: false, added: true },
        ],
      },
      files: new Map([
        ['aaaa::a.st', 'FUNCTION_BLOCK a\nEND_FUNCTION_BLOCK\n'],
        ['bbbb::a.st', 'FUNCTION_BLOCK a\nEND_FUNCTION_BLOCK\n'],
        ['bbbb::new.st', 'FUNCTION_BLOCK new\nEND_FUNCTION_BLOCK\n'],
      ]),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const { before, after } = await loadGitHubPrSnapshot(opts, fakeApi(state));
    expect(before.map((f) => f.path)).toEqual(['a.st']);
    expect(after.map((f) => f.path).sort()).toEqual(['a.st', 'new.st']);
  });
});

const findings: Finding[] = [
  {
    severity: 'error',
    category: 'CALL_SITE_OUTDATED',
    file: 'MAIN.st',
    line: 12,
    summary: 'Call out of date',
  },
];

const postOpts: GitHubPostOptions = {
  ...opts,
  commentStyle: 'inline',
  // Tests don't need the production rate-limit pacing or batch spacing.
  interPostDelayMs: 0,
  interBatchDelayMs: 0,
};

describe('postGitHubReview', () => {
  const ctx = ctxWithDiff('MAIN.st', 1, 30);
  it('creates a review comment when nothing exists', async () => {
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(findings, ctx, postOpts, fakeApi(state));
    expect(result.mode).toBe('inline');
    expect(result.inDiff).toBe(1);
    expect(result.outOfDiff).toBe(0);
    expect(result.created).toBe(1);
    // New inline findings are batched into a single PR review POST,
    // not posted one-by-one.
    expect(state.log[0]).toMatchObject({
      kind: 'createReview',
      comments: [{ path: 'MAIN.st', line: 12 }],
    });
    expect(state.log.filter((e) => e.kind === 'create')).toHaveLength(0);
  });

  it('updates an existing review comment when body changed', async () => {
    const key = 'CALL_SITE_OUTDATED|MAIN.st|12';
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [
        {
          id: 11,
          body: `<!-- plc-st-review:v1 kind=finding key=${key} -->\nold body`,
          path: 'MAIN.st',
          line: 12,
        },
      ],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(findings, ctx, postOpts, fakeApi(state));
    expect(result.updated).toBe(1);
    expect(state.log.some((e) => e.kind === 'update')).toBe(true);
  });

  it('deletes review comments whose findings no longer apply', async () => {
    const staleKey = 'CALL_SITE_OUTDATED|Old.st|3';
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [
        {
          id: 99,
          body: `<!-- plc-st-review:v1 kind=finding key=${staleKey} -->\nstale`,
          path: 'Old.st',
          line: 3,
        },
      ],
      issueComments: [],
      log: [],
    };
    await postGitHubReview(findings, ctx, postOpts, fakeApi(state));
    expect(state.log.some((e) => e.kind === 'delete' && e.id === 99)).toBe(true);
  });

  it('folds out-of-diff findings into the summary issue comment', async () => {
    // Diff covers lines 100-110 of MAIN.st only, finding at line 12 is
    // out-of-diff and must be reported via the summary comment.
    const narrowCtx = ctxWithDiff('MAIN.st', 100, 10);
    const state: FakeState = {
      context: narrowCtx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(findings, narrowCtx, postOpts, fakeApi(state));
    expect(result.inDiff).toBe(0);
    expect(result.outOfDiff).toBe(1);
    const issueCreates = state.log.filter((e) => e.kind === 'createIssue');
    expect(issueCreates).toHaveLength(1);
    expect((issueCreates[0] as { body: string }).body).toContain('CALL_SITE_OUTDATED');
    expect((issueCreates[0] as { body: string }).body).toContain('outside the PR');
  });

  it('falls back to summary-only above the cap', async () => {
    const many: Finding[] = Array.from({ length: 5 }, (_, i) => ({
      severity: 'info',
      category: 'COMMENT_ONLY',
      file: `f${i}.st`,
      line: 1,
      summary: `n ${i}`,
    }));
    const state: FakeState = {
      context: baseContext,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(
      many,
      baseContext,
      { ...postOpts, inlineCap: 3 },
      fakeApi(state),
    );
    expect(result.mode).toBe('summary-only');
    expect(state.log.filter((e) => e.kind === 'createIssue')).toHaveLength(1);
  });

  it('batches multiple new findings into a single createReview POST', async () => {
    // The whole point of switching to /reviews: one network call carries
    // every new inline comment, sidestepping the secondary rate limiter
    // that the per-comment endpoint trips on rapid POSTs.
    const wideCtx = ctxWithDiff('MAIN.st', 1, 60);
    const many: Finding[] = [
      { severity: 'warn', category: 'BOOL_COMPARISON', file: 'MAIN.st', line: 5, summary: 'a' },
      { severity: 'warn', category: 'REAL_EQUALITY', file: 'MAIN.st', line: 12, summary: 'b' },
      { severity: 'info', category: 'NESTED_COMMENTS', file: 'MAIN.st', line: 30, summary: 'c' },
    ];
    const state: FakeState = {
      context: wideCtx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(many, wideCtx, postOpts, fakeApi(state));
    expect(result.created).toBe(3);
    const reviews = state.log.filter((e) => e.kind === 'createReview');
    expect(reviews).toHaveLength(1);
    expect(reviews[0]).toMatchObject({
      comments: [
        { path: 'MAIN.st', line: 5 },
        { path: 'MAIN.st', line: 12 },
        { path: 'MAIN.st', line: 30 },
      ],
    });
    // And zero per-comment POSTs.
    expect(state.log.filter((e) => e.kind === 'create')).toHaveLength(0);
  });

  it('splits very large finding sets across multiple /reviews POSTs', async () => {
    // GitHub's /reviews endpoint 502s on huge payloads. The engine caps
    // each batch and spaces them out. 50 findings with batch size 20
    // should arrive as ceil(50 / 20) = 3 POSTs.
    const wideCtx = ctxWithDiff('MAIN.st', 1, 200);
    const many: Finding[] = Array.from({ length: 50 }, (_, i) => ({
      severity: 'info',
      category: 'COMMENT_ONLY',
      file: 'MAIN.st',
      line: i + 1,
      summary: `n ${i}`,
    }));
    const state: FakeState = {
      context: wideCtx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(
      many,
      wideCtx,
      { ...postOpts, reviewBatchSize: 20 },
      fakeApi(state),
    );
    expect(result.created).toBe(50);
    const reviews = state.log.filter((e) => e.kind === 'createReview');
    expect(reviews).toHaveLength(3);
    expect(reviews[0]).toMatchObject({ comments: expect.any(Array) });
    expect((reviews[0] as { comments: unknown[] }).comments).toHaveLength(20);
    expect((reviews[1] as { comments: unknown[] }).comments).toHaveLength(20);
    expect((reviews[2] as { comments: unknown[] }).comments).toHaveLength(10);
    // No per-comment fallback was needed.
    expect(state.log.filter((e) => e.kind === 'create')).toHaveLength(0);
  });

  it('falls back to per-comment posts when the batch /reviews POST fails', async () => {
    // On batch failure (e.g. one comment is malformed and GitHub rejects
    // the whole review), the engine retries each finding individually with
    // the pacing + rate-limit retry safety net. Here createReview always
    // throws, so all new findings go through createReviewComment.
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const inner = fakeApi(state);
    const apiFallback = {
      ...inner,
      async createReview(): Promise<void> {
        throw new Error('Validation Failed: bad batch');
      },
    };
    const result = await postGitHubReview(findings, ctx, postOpts, apiFallback);
    expect(result.created).toBe(1);
    expect(state.log.filter((e) => e.kind === 'create')).toHaveLength(1);
  });

  it('retries the per-comment fallback once on a "submitted too quickly" 422', async () => {
    // Batch fails → fallback engages → first per-comment POST hits the
    // secondary rate limiter → retry after a back-off succeeds.
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const inner = fakeApi(state);
    let attempts = 0;
    const flaky = {
      ...inner,
      async createReview(): Promise<void> {
        throw new Error('Validation Failed: bad batch');
      },
      async createReviewComment(args: {
        body: string;
        commitId: string;
        path: string;
        line: number;
      }): Promise<void> {
        attempts += 1;
        if (attempts === 1) {
          throw new Error(
            'Validation Failed: pull_request_review_thread.base was submitted too quickly',
          );
        }
        return inner.createReviewComment(args);
      },
    };
    const result = await postGitHubReview(findings, ctx, postOpts, flaky);
    expect(attempts).toBe(2);
    expect(result.created).toBe(1);
    expect(result.outOfDiff).toBe(0);
  });

  it('folds into the summary when the fallback retry also hits the rate limit', async () => {
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const inner = fakeApi(state);
    let attempts = 0;
    const stuck = {
      ...inner,
      async createReview(): Promise<void> {
        throw new Error('Validation Failed: bad batch');
      },
      async createReviewComment(): Promise<void> {
        attempts += 1;
        throw new Error(
          'Validation Failed: pull_request_review_thread.base was submitted too quickly',
        );
      },
    };
    const result = await postGitHubReview(findings, ctx, postOpts, stuck);
    expect(attempts).toBe(2); // initial + one retry
    expect(state.log.filter((e) => e.kind === 'create')).toHaveLength(0);
    expect(state.log.filter((e) => e.kind === 'createIssue')).toHaveLength(1);
    expect(result.outOfDiff).toBe(1);
    expect(result.inDiff).toBe(0);
  });

  it('updates an existing summary issue comment', async () => {
    const state: FakeState = {
      context: ctx,
      files: new Map(),
      reviewComments: [],
      issueComments: [
        {
          id: 55,
          body: `<!-- plc-st-review:v1 kind=summary -->\n## plc-st-review\n\nOld summary`,
        },
      ],
      log: [],
    };
    const result = await postGitHubReview(
      findings,
      ctx,
      { ...postOpts, commentStyle: 'summary' },
      fakeApi(state),
    );
    expect(result.mode).toBe('summary-only');
    expect(state.log.some((e) => e.kind === 'updateIssue' && e.id === 55)).toBe(true);
  });
});
