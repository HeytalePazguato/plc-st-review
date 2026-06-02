import { Buffer } from 'node:buffer';
import { Octokit } from '@octokit/rest';
import { parseSource } from '../engine/parse.js';
import type { AstFile, Finding, ResolvedConfig, Severity } from '../engine/types.js';

const ST_EXTENSIONS = new Set<string>(['.st', '.ST', '.iecst', '.IECST']);
const MARKER_PREFIX = '<!-- plc-st-review:v1';
const SUMMARY_MARKER = `${MARKER_PREFIX} kind=summary -->`;
const SEVERITY_BADGE: Record<Severity, string> = {
  error: '🟥 error',
  warn: '🟧 warn',
  info: '🟦 info',
};
const INLINE_CAP = 100;

export interface GitHubOptions {
  token: string;
  baseUrl?: string;
  owner: string;
  repo: string;
  pullNumber: number;
}

export interface GitHubChange {
  oldPath: string;
  newPath: string;
  renamed: boolean;
  removed: boolean;
  added: boolean;
  patch?: string;
}

export interface PrContext {
  baseSha: string;
  headSha: string;
  baseRef: string;
  headRef: string;
  changes: GitHubChange[];
}

export interface ReviewComment {
  id: number;
  body: string;
  path: string;
  line: number | null;
}

export interface IssueComment {
  id: number;
  body: string;
}

export interface GitHubApi {
  fetchPrContext(): Promise<PrContext>;
  fetchFile(ref: string, path: string): Promise<string | null>;
  listStFiles(ref: string): Promise<string[]>;
  listReviewComments(): Promise<ReviewComment[]>;
  listIssueComments(): Promise<IssueComment[]>;
  createReviewComment(args: {
    body: string;
    commitId: string;
    path: string;
    line: number;
  }): Promise<void>;
  /**
   * Submit a single PR review carrying any number of inline anchored
   * comments in one POST. Avoids GitHub's secondary rate limiter on
   * rapid per-comment POSTs and renders as a single review-submitted
   * timeline event instead of N separate review-comment events.
   */
  createReview(args: {
    commitId: string;
    body?: string;
    comments: ReadonlyArray<{ path: string; line: number; body: string }>;
  }): Promise<void>;
  updateReviewComment(id: number, body: string): Promise<void>;
  deleteReviewComment(id: number): Promise<void>;
  createIssueComment(body: string): Promise<void>;
  updateIssueComment(id: number, body: string): Promise<void>;
}

export function createOctokitClient(opts: GitHubOptions): GitHubApi {
  const octokit = new Octokit({
    auth: opts.token,
    baseUrl: opts.baseUrl ?? 'https://api.github.com',
  });

  return {
    async fetchPrContext() {
      const pr = await octokit.pulls.get({
        owner: opts.owner,
        repo: opts.repo,
        pull_number: opts.pullNumber,
      });
      const filesPaged = await octokit.paginate(octokit.pulls.listFiles, {
        owner: opts.owner,
        repo: opts.repo,
        pull_number: opts.pullNumber,
        per_page: 100,
      });
      return {
        baseSha: pr.data.base.sha,
        headSha: pr.data.head.sha,
        baseRef: pr.data.base.ref,
        headRef: pr.data.head.ref,
        changes: filesPaged.map((f) => ({
          oldPath: f.previous_filename ?? f.filename,
          newPath: f.filename,
          renamed: f.status === 'renamed',
          removed: f.status === 'removed',
          added: f.status === 'added',
          patch: f.patch,
        })),
      };
    },
    async fetchFile(ref, path) {
      try {
        const res = await octokit.repos.getContent({
          owner: opts.owner,
          repo: opts.repo,
          path,
          ref,
        });
        const data = res.data as { content?: string; encoding?: string };
        if (typeof data.content === 'string' && data.encoding === 'base64') {
          return Buffer.from(data.content, 'base64').toString('utf8');
        }
        return null;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async listStFiles(ref) {
      try {
        const res = await octokit.git.getTree({
          owner: opts.owner,
          repo: opts.repo,
          tree_sha: ref,
          recursive: 'true',
        });
        if (res.data.truncated) {
          // GitHub truncates a recursive tree response beyond ~100k entries or
          // 7 MB. The flat result would silently miss files, so fall back to a
          // per-directory walk that fetches each subtree on its own.
          process.stderr.write(
            `plc-st-review: git tree at ${ref.slice(0, 8)} was truncated by GitHub; falling back to per-directory walk (this run may be slower)\n`,
          );
          return await walkTreeForStFiles(ref, async (treeSha) => {
            const sub = await octokit.git.getTree({
              owner: opts.owner,
              repo: opts.repo,
              tree_sha: treeSha,
            });
            return { tree: sub.data.tree, truncated: sub.data.truncated === true };
          });
        }
        const out: string[] = [];
        for (const item of res.data.tree) {
          if (item.type !== 'blob') continue;
          const p = item.path;
          if (typeof p === 'string' && endsWithStExt(p)) out.push(p);
        }
        return out;
      } catch (err) {
        if (isNotFound(err)) return [];
        throw err;
      }
    },
    async listReviewComments() {
      const all = await octokit.paginate(octokit.pulls.listReviewComments, {
        owner: opts.owner,
        repo: opts.repo,
        pull_number: opts.pullNumber,
        per_page: 100,
      });
      return all.map((c) => ({
        id: c.id,
        body: c.body,
        path: c.path,
        line: c.line ?? null,
      }));
    },
    async listIssueComments() {
      const all = await octokit.paginate(octokit.issues.listComments, {
        owner: opts.owner,
        repo: opts.repo,
        issue_number: opts.pullNumber,
        per_page: 100,
      });
      return all.map((c) => ({ id: c.id, body: c.body ?? '' }));
    },
    async createReviewComment(args) {
      await octokit.pulls.createReviewComment({
        owner: opts.owner,
        repo: opts.repo,
        pull_number: opts.pullNumber,
        body: args.body,
        commit_id: args.commitId,
        path: args.path,
        line: args.line,
        side: 'RIGHT',
      });
    },
    async createReview(args) {
      await octokit.pulls.createReview({
        owner: opts.owner,
        repo: opts.repo,
        pull_number: opts.pullNumber,
        commit_id: args.commitId,
        event: 'COMMENT',
        body: args.body,
        comments: args.comments.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
          side: 'RIGHT',
        })),
      });
    },
    async updateReviewComment(id, body) {
      await octokit.pulls.updateReviewComment({
        owner: opts.owner,
        repo: opts.repo,
        comment_id: id,
        body,
      });
    },
    async deleteReviewComment(id) {
      await octokit.pulls.deleteReviewComment({
        owner: opts.owner,
        repo: opts.repo,
        comment_id: id,
      });
    },
    async createIssueComment(body) {
      await octokit.issues.createComment({
        owner: opts.owner,
        repo: opts.repo,
        issue_number: opts.pullNumber,
        body,
      });
    },
    async updateIssueComment(id, body) {
      await octokit.issues.updateComment({
        owner: opts.owner,
        repo: opts.repo,
        comment_id: id,
        body,
      });
    },
  };
}

function isNotFound(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  return status === 404;
}

function endsWithStExt(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return ST_EXTENSIONS.has(path.slice(dot));
}

/**
 * Walk a git tree by SHA, calling `fetcher` per subtree (non-recursive), and
 * collect every `.st` blob path. Used as the truncation fallback when the
 * recursive Trees API response is capped (~100k entries / 7 MB) — the per-
 * directory walk dodges that cap at the cost of one API call per subtree.
 * Exported separately so the walk logic is unit-testable without an Octokit.
 */
export interface TreeEntry {
  type?: string;
  path?: string;
  sha?: string;
}
export type TreeFetcher = (
  treeSha: string,
) => Promise<{ tree: readonly TreeEntry[]; truncated: boolean }>;

export async function walkTreeForStFiles(
  rootSha: string,
  fetcher: TreeFetcher,
): Promise<string[]> {
  const out: string[] = [];
  const visited = new Set<string>();
  const stack: Array<{ sha: string; prefix: string }> = [
    { sha: rootSha, prefix: '' },
  ];
  while (stack.length > 0) {
    const { sha, prefix } = stack.pop()!;
    if (visited.has(sha)) continue;
    visited.add(sha);
    let res: { tree: readonly TreeEntry[]; truncated: boolean };
    try {
      res = await fetcher(sha);
    } catch {
      continue;
    }
    if (res.truncated) {
      process.stderr.write(
        `plc-st-review: subtree ${sha.slice(0, 8)} is itself truncated; some files in this directory may be missing\n`,
      );
    }
    for (const item of res.tree) {
      const name = typeof item.path === 'string' ? item.path : '';
      if (!name) continue;
      const full = prefix ? `${prefix}/${name}` : name;
      if (item.type === 'blob') {
        if (endsWithStExt(full)) out.push(full);
      } else if (item.type === 'tree' && typeof item.sha === 'string') {
        stack.push({ sha: item.sha, prefix: full });
      }
    }
  }
  return out;
}

/**
 * Extract the set of NEW-side line numbers covered by a unified-diff patch.
 * Used to decide whether a finding's (file, line) is postable as an inline
 * review comment. GitHub rejects review comments that anchor to lines not
 * present in any diff hunk.
 */
export function diffLinesByFile(changes: readonly GitHubChange[]): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  for (const c of changes) {
    if (!c.patch) continue;
    const set = new Set<number>();
    let newLine = 0;
    for (const raw of c.patch.split('\n')) {
      const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (hunk) {
        newLine = Number.parseInt(hunk[1], 10);
        continue;
      }
      if (raw.startsWith('+') && !raw.startsWith('+++')) {
        set.add(newLine);
        newLine += 1;
      } else if (raw.startsWith('-') && !raw.startsWith('---')) {
        // deletion, does not advance NEW side
      } else if (!raw.startsWith('\\')) {
        // context line or empty
        newLine += 1;
      }
    }
    out.set(c.newPath, set);
  }
  return out;
}

export async function loadGitHubPrSnapshot(
  opts: GitHubOptions,
  api: GitHubApi = createOctokitClient(opts),
): Promise<{ before: AstFile[]; after: AstFile[]; context: PrContext }> {
  const context = await api.fetchPrContext();
  // Cross-file analysis (CALL_SITE_OUTDATED, STATE_UNHANDLED, ENUM_VALUE_*,
  // METHOD_ADDED_TO_INTERFACE, POU_DELETED) needs full-repo visibility, not
  // just the diffed files. Walk the entire tree at base and head SHAs.
  const [beforePaths, afterPaths] = await Promise.all([
    api.listStFiles(context.baseSha),
    api.listStFiles(context.headSha),
  ]);
  const before: AstFile[] = [];
  const after: AstFile[] = [];
  for (const path of afterPaths) {
    const src = await api.fetchFile(context.headSha, path);
    if (src !== null) after.push(await parseSource(src, path));
  }
  for (const path of beforePaths) {
    const src = await api.fetchFile(context.baseSha, path);
    if (src !== null) before.push(await parseSource(src, path));
  }
  return { before, after, context };
}

export interface GitHubPostOptions extends GitHubOptions {
  commentStyle: ResolvedConfig['commentStyle'];
  inlineCap?: number;
  /**
   * Milliseconds to wait between successive inline createReviewComment POSTs.
   * GitHub's secondary rate limiter rejects rapid-fire posts with a 422
   * "was submitted too quickly". 250 ms keeps the same 50-finding run under
   * 15 s of added wall time and effectively eliminates the throttle. Tests
   * can pass 0 to skip the gap.
   */
  interPostDelayMs?: number;
  /**
   * Max inline comments per /reviews POST. The endpoint times out (502) on
   * very large batches, empirically a single batch of 47 took >10 s server
   * side. 20 finishes well under any timeout and still gives ~95% of the
   * rate-limit benefit (one round trip per chunk instead of N per comment).
   * Tests can pass Infinity to keep the whole batch in one call.
   */
  reviewBatchSize?: number;
  /**
   * Milliseconds to wait between successive /reviews POSTs when the inline
   * comment set spans multiple batches. Spaces out the chunks so we don't
   * trip the same secondary rate limiter that the per-comment path does.
   */
  interBatchDelayMs?: number;
}

const DEFAULT_INTER_POST_DELAY_MS = 250;
const DEFAULT_REVIEW_BATCH_SIZE = 20;
const DEFAULT_INTER_BATCH_DELAY_MS = 1000;
const RATE_LIMIT_BACKOFF_MS = 1500;

function sleep(ms: number): Promise<void> {
  return ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : Promise.resolve();
}

function isRateLimitError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? '';
  return /submitted too quickly|secondary rate|abuse/i.test(msg);
}

export interface PostReviewResult {
  created: number;
  updated: number;
  deleted: number;
  mode: 'inline' | 'summary-only';
  inDiff: number;
  outOfDiff: number;
}

function findingKey(f: Finding): string {
  return `${f.category}|${f.file}|${f.line}`;
}

function findingMarker(f: Finding): string {
  return `${MARKER_PREFIX} kind=finding key=${findingKey(f)} -->`;
}

function renderFindingBody(f: Finding): string {
  const lines: string[] = [
    findingMarker(f),
    `**${SEVERITY_BADGE[f.severity]} \`${f.category}\`**: ${f.summary}`,
  ];
  if (f.detail) {
    lines.push('');
    lines.push('```');
    lines.push(f.detail);
    lines.push('```');
  }
  if (f.related && f.related.length > 0) {
    lines.push('');
    lines.push('Related:');
    for (const r of f.related) {
      lines.push(`- \`${r.file}:${r.line}\`${r.note ? ' (' + r.note + ')' : ''}`);
    }
  }
  return lines.join('\n');
}

function renderSummaryBody(
  findings: Finding[],
  context: PrContext,
  scope: 'all' | 'out-of-diff' = 'all',
): string {
  const lines: string[] = [SUMMARY_MARKER, '## plc-st-review'];
  if (findings.length === 0) {
    lines.push('');
    lines.push('No semantic findings. ✅');
    return lines.join('\n');
  }
  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  lines.push('');
  if (scope === 'out-of-diff') {
    lines.push(
      `${findings.length} finding${plural(findings.length)} on lines outside the PR's diff hunks ` +
        '(GitHub only allows inline review comments on lines included in the diff). The rest, ' +
        'if any, are posted as inline review comments above.',
    );
  } else {
    lines.push(
      `**${counts.error} error${plural(counts.error)}, ${counts.warn} warning${plural(counts.warn)}, ${counts.info} info** ` +
        `on \`${context.headRef}\` → \`${context.baseRef}\` (${context.headSha.slice(0, 8)}).`,
    );
  }
  lines.push('');
  lines.push('| Severity | Category | Location | Summary |');
  lines.push('|---|---|---|---|');
  for (const f of findings) {
    lines.push(
      `| ${SEVERITY_BADGE[f.severity]} | \`${f.category}\` | \`${f.file}:${f.line}\` | ${escape(f.summary)} |`,
    );
  }
  return lines.join('\n');
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

function escape(text: string): string {
  return text.replace(/\|/g, '\\|');
}

/**
 * Per-comment fallback used when the batch /reviews POST fails. Mirrors
 * the original behaviour: pace between posts to dodge the secondary
 * rate limit, retry once on the "submitted too quickly" 422, and fold
 * any still-failing finding into the out-of-diff list (which the summary
 * comment will pick up).
 */
async function postIndividually(
  toCreate: readonly Finding[],
  context: PrContext,
  api: GitHubApi,
  result: PostReviewResult,
  outOfDiffFindings: Finding[],
  interPostDelayMs: number,
): Promise<void> {
  for (const f of toCreate) {
    const args = {
      body: renderFindingBody(f),
      commitId: context.headSha,
      path: f.file,
      line: f.line,
    };
    try {
      await api.createReviewComment(args);
      result.created += 1;
    } catch (err) {
      if (isRateLimitError(err)) {
        await sleep(RATE_LIMIT_BACKOFF_MS);
        try {
          await api.createReviewComment(args);
          result.created += 1;
          await sleep(interPostDelayMs);
          continue;
        } catch (retryErr) {
          err = retryErr;
        }
      }
      process.stderr.write(
        `plc-st-review: inline post failed for ${f.file}:${f.line} (${(err as Error).message}); folding into summary\n`,
      );
      outOfDiffFindings.push(f);
      result.inDiff -= 1;
      result.outOfDiff += 1;
      continue;
    }
    await sleep(interPostDelayMs);
  }
}

export async function postGitHubReview(
  findings: Finding[],
  context: PrContext,
  opts: GitHubPostOptions,
  api: GitHubApi = createOctokitClient(opts),
): Promise<PostReviewResult> {
  const inlineCap = opts.inlineCap ?? INLINE_CAP;
  const interPostDelayMs = opts.interPostDelayMs ?? DEFAULT_INTER_POST_DELAY_MS;
  const reviewBatchSize = opts.reviewBatchSize ?? DEFAULT_REVIEW_BATCH_SIZE;
  const interBatchDelayMs = opts.interBatchDelayMs ?? DEFAULT_INTER_BATCH_DELAY_MS;
  const mode: PostReviewResult['mode'] =
    findings.length > inlineCap || opts.commentStyle === 'summary'
      ? 'summary-only'
      : 'inline';

  const result: PostReviewResult = {
    created: 0,
    updated: 0,
    deleted: 0,
    mode,
    inDiff: 0,
    outOfDiff: 0,
  };

  // Compute which (file, line) pairs are part of the PR's diff hunks. GitHub
  // rejects inline review comments anchored to lines outside the diff with
  // "pull_request_review_thread.line could not be resolved".
  const diffLines = diffLinesByFile(context.changes);
  const isInDiff = (f: Finding): boolean =>
    diffLines.get(f.file)?.has(f.line) ?? false;

  const inDiffFindings: Finding[] = [];
  const outOfDiffFindings: Finding[] = [];
  for (const f of findings) {
    if (mode === 'inline' && isInDiff(f)) inDiffFindings.push(f);
    else outOfDiffFindings.push(f);
  }
  result.inDiff = inDiffFindings.length;
  result.outOfDiff = outOfDiffFindings.length;

  if (mode === 'inline' && inDiffFindings.length > 0) {
    const existing = await api.listReviewComments();
    const ours = new Map<string, ReviewComment>();
    for (const c of existing) {
      if (!c.body.startsWith(MARKER_PREFIX)) continue;
      const m = /key=([^\s]+)/.exec(c.body);
      if (m) ours.set(m[1], c);
    }
    const incoming = new Set<string>();
    const toCreate: Finding[] = [];
    for (const f of inDiffFindings) {
      const key = findingKey(f);
      incoming.add(key);
      const body = renderFindingBody(f);
      const prior = ours.get(key);
      if (prior) {
        if (prior.body !== body) {
          await api.updateReviewComment(prior.id, body);
          result.updated += 1;
        }
      } else {
        toCreate.push(f);
      }
    }
    // Batch new inline comments into one or more /reviews POSTs. The
    // endpoint times out (502) on very large payloads, empirically a
    // single batch of 47 took >10 s server-side, so we cap each batch
    // at reviewBatchSize and space the batches apart. Most PRs fit in a
    // single batch; the demo (~50 findings) takes ~3.
    for (let i = 0; i < toCreate.length; i += reviewBatchSize) {
      const chunk = toCreate.slice(i, i + reviewBatchSize);
      const comments = chunk.map((f) => ({
        path: f.file,
        line: f.line,
        body: renderFindingBody(f),
      }));
      try {
        await api.createReview({ commitId: context.headSha, comments });
        result.created += chunk.length;
      } catch (err) {
        // Batch failed (e.g. one comment in the chunk was malformed,
        // anchored to a line GitHub now considers out-of-diff, or the
        // payload was still too large). Fall back to per-comment POSTs
        // with the pacing/retry safety net for this chunk only.
        process.stderr.write(
          `plc-st-review: batch review failed (${(err as Error).message}); falling back to per-comment posts for ${chunk.length} finding(s)\n`,
        );
        await postIndividually(
          chunk,
          context,
          api,
          result,
          outOfDiffFindings,
          interPostDelayMs,
        );
      }
      if (i + reviewBatchSize < toCreate.length) {
        await sleep(interBatchDelayMs);
      }
    }
    for (const [key, prior] of ours) {
      if (incoming.has(key)) continue;
      await api.deleteReviewComment(prior.id);
      result.deleted += 1;
    }
  }

  // Always emit a summary issue comment when there are out-of-diff findings,
  // or when the user explicitly asked for summary mode.
  if (outOfDiffFindings.length > 0 || opts.commentStyle !== 'inline' || mode === 'summary-only') {
    const issueComments = await api.listIssueComments();
    const summary =
      issueComments.find((c) => c.body.startsWith(SUMMARY_MARKER)) ?? null;
    const body = renderSummaryBody(
      mode === 'summary-only' ? findings : outOfDiffFindings,
      context,
      mode === 'summary-only' ? 'all' : 'out-of-diff',
    );
    if (summary) {
      if (summary.body !== body) {
        await api.updateIssueComment(summary.id, body);
        result.updated += 1;
      }
    } else {
      await api.createIssueComment(body);
      result.created += 1;
    }
  }

  return result;
}

export function resolveGitHubOptionsFromEnv(
  override: Partial<GitHubOptions>,
): GitHubOptions {
  const token = override.token ?? process.env.GITHUB_TOKEN ?? null;
  if (!token) throw new Error('GITHUB_TOKEN must be set');
  let owner = override.owner;
  let repo = override.repo;
  if ((!owner || !repo) && process.env.GITHUB_REPOSITORY) {
    const parts = process.env.GITHUB_REPOSITORY.split('/');
    if (parts.length === 2) {
      owner = owner ?? parts[0];
      repo = repo ?? parts[1];
    }
  }
  if (!owner || !repo) throw new Error('--repo <owner>/<name> or GITHUB_REPOSITORY must be set');
  const pullNumber = override.pullNumber;
  if (pullNumber === undefined) throw new Error('--pr <number> must be provided');
  return {
    token,
    baseUrl: override.baseUrl ?? process.env.GITHUB_API_URL,
    owner,
    repo,
    pullNumber,
  };
}
