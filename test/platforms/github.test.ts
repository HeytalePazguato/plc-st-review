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

const postOpts: GitHubPostOptions = { ...opts, commentStyle: 'inline' };

describe('postGitHubReview', () => {
  it('creates a review comment when nothing exists', async () => {
    const state: FakeState = {
      context: baseContext,
      files: new Map(),
      reviewComments: [],
      issueComments: [],
      log: [],
    };
    const result = await postGitHubReview(findings, baseContext, postOpts, fakeApi(state));
    expect(result.mode).toBe('inline');
    expect(result.created).toBe(1);
    expect(state.log[0]).toMatchObject({ kind: 'create', path: 'MAIN.st', line: 12 });
  });

  it('updates an existing review comment when body changed', async () => {
    const key = 'CALL_SITE_OUTDATED|MAIN.st|12';
    const state: FakeState = {
      context: baseContext,
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
    const result = await postGitHubReview(findings, baseContext, postOpts, fakeApi(state));
    expect(result.updated).toBe(1);
    expect(state.log.some((e) => e.kind === 'update')).toBe(true);
  });

  it('deletes review comments whose findings no longer apply', async () => {
    const staleKey = 'CALL_SITE_OUTDATED|Old.st|3';
    const state: FakeState = {
      context: baseContext,
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
    await postGitHubReview(findings, baseContext, postOpts, fakeApi(state));
    expect(state.log.some((e) => e.kind === 'delete' && e.id === 99)).toBe(true);
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

  it('updates an existing summary issue comment', async () => {
    const state: FakeState = {
      context: baseContext,
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
      baseContext,
      { ...postOpts, commentStyle: 'summary' },
      fakeApi(state),
    );
    expect(result.mode).toBe('summary-only');
    expect(state.log.some((e) => e.kind === 'updateIssue' && e.id === 55)).toBe(true);
  });
});
