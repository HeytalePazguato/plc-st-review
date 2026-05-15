import { Buffer } from 'node:buffer';
import { Gitlab } from '@gitbeaker/rest';
import { parseSource } from '../engine/parse.js';
import type { AstFile, Finding, ResolvedConfig, Severity } from '../engine/types.js';

const ST_EXTENSIONS = new Set<string>(['.st', '.ST', '.iecst', '.IECST']);
const MARKER_PREFIX = '<!-- plc-st-review:v1';
const SEVERITY_BADGE: Record<Severity, string> = {
  error: '🟥 error',
  warn: '🟧 warn',
  info: '🟦 info',
};
const SUMMARY_MARKER = `${MARKER_PREFIX} kind=summary -->`;
const INLINE_CAP = 100;

export interface GitlabOptions {
  token: string;
  host: string;
  projectId: string | number;
  mrIid: number;
}

export interface MrChange {
  oldPath: string;
  newPath: string;
  renamedFile: boolean;
  deletedFile: boolean;
  newFile: boolean;
}

export interface MrContext {
  baseSha: string;
  headSha: string;
  startSha: string;
  targetBranch: string;
  sourceBranch: string;
  changes: MrChange[];
}

export interface ApiNote {
  id: number;
  body: string;
  resolvable?: boolean;
  resolved?: boolean;
}

export interface ApiDiscussion {
  id: string;
  notes: ApiNote[];
}

export interface InlinePosition {
  baseSha: string;
  headSha: string;
  startSha: string;
  newPath: string;
  oldPath: string;
  newLine: number;
}

export interface GitlabApi {
  fetchMrContext(projectId: string | number, mrIid: number): Promise<MrContext>;
  fetchFile(projectId: string | number, ref: string, path: string): Promise<string | null>;
  listStFiles(projectId: string | number, ref: string): Promise<string[]>;
  listDiscussions(projectId: string | number, mrIid: number): Promise<ApiDiscussion[]>;
  createDiscussion(
    projectId: string | number,
    mrIid: number,
    body: string,
    position?: InlinePosition,
  ): Promise<void>;
  editNote(
    projectId: string | number,
    mrIid: number,
    discussionId: string,
    noteId: number,
    body: string,
  ): Promise<void>;
  resolveDiscussion(
    projectId: string | number,
    mrIid: number,
    discussionId: string,
  ): Promise<void>;
}

interface RawMr {
  diff_refs: { base_sha: string; head_sha: string; start_sha: string };
  target_branch: string;
  source_branch: string;
}

interface RawDiff {
  old_path: string;
  new_path: string;
  renamed_file?: boolean;
  deleted_file?: boolean;
  new_file?: boolean;
}

interface RawFile {
  content: string;
  encoding: string;
}

interface RawNote {
  id: number;
  body: string;
  resolvable?: boolean;
  resolved?: boolean;
}

interface RawDiscussion {
  id: string;
  notes?: RawNote[];
}

export function createGitbeakerClient(opts: GitlabOptions): GitlabApi {
  const gl = new Gitlab({ token: opts.token, host: opts.host });
  return {
    async fetchMrContext(projectId, mrIid) {
      const mr = (await gl.MergeRequests.show(projectId, mrIid)) as unknown as RawMr;
      const diffs = (await gl.MergeRequests.allDiffs(projectId, mrIid)) as unknown as RawDiff[];
      return {
        baseSha: mr.diff_refs.base_sha,
        headSha: mr.diff_refs.head_sha,
        startSha: mr.diff_refs.start_sha,
        targetBranch: mr.target_branch,
        sourceBranch: mr.source_branch,
        changes: diffs.map((d) => ({
          oldPath: d.old_path,
          newPath: d.new_path,
          renamedFile: d.renamed_file ?? false,
          deletedFile: d.deleted_file ?? false,
          newFile: d.new_file ?? false,
        })),
      };
    },
    async fetchFile(projectId, ref, path) {
      try {
        const file = (await gl.RepositoryFiles.show(projectId, path, ref)) as unknown as RawFile;
        if (file.encoding === 'base64') {
          return Buffer.from(file.content, 'base64').toString('utf8');
        }
        return file.content;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async listStFiles(projectId, ref) {
      const tree = (await gl.Repositories.allRepositoryTrees(projectId, {
        ref,
        recursive: true,
        perPage: 100,
      })) as unknown as Array<{ type: string; path: string }>;
      return tree.filter((t) => t.type === 'blob' && endsWithStExt(t.path)).map((t) => t.path);
    },
    async listDiscussions(projectId, mrIid) {
      const list = (await gl.MergeRequestDiscussions.all(
        projectId,
        mrIid,
      )) as unknown as RawDiscussion[];
      return list.map((d) => ({
        id: d.id,
        notes: (d.notes ?? []).map((n) => ({
          id: n.id,
          body: n.body,
          resolvable: n.resolvable ?? false,
          resolved: n.resolved ?? false,
        })),
      }));
    },
    async createDiscussion(projectId, mrIid, body, position) {
      if (position) {
        await gl.MergeRequestDiscussions.create(projectId, mrIid, body, {
          position: {
            baseSha: position.baseSha,
            headSha: position.headSha,
            startSha: position.startSha,
            positionType: 'text',
            newPath: position.newPath,
            oldPath: position.oldPath,
            newLine: String(position.newLine),
          } as never,
        });
      } else {
        await gl.MergeRequestDiscussions.create(projectId, mrIid, body);
      }
    },
    async editNote(projectId, mrIid, discussionId, noteId, body) {
      await gl.MergeRequestDiscussions.editNote(projectId, mrIid, discussionId, noteId, {
        body,
      });
    },
    async resolveDiscussion(projectId, mrIid, discussionId) {
      try {
        await gl.MergeRequestDiscussions.resolve(projectId, mrIid, discussionId, true);
      } catch {
        // Some discussions are not resolvable via API; non-fatal.
      }
    },
  };
}

function isNotFound(err: unknown): boolean {
  const status = (err as { cause?: { response?: { status?: number } } }).cause?.response?.status;
  return status === 404;
}

function endsWithStExt(path: string): boolean {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return false;
  return ST_EXTENSIONS.has(path.slice(dot));
}

void isNotFound;

export async function loadGitlabMrSnapshot(
  opts: GitlabOptions,
  api: GitlabApi = createGitbeakerClient(opts),
): Promise<{ before: AstFile[]; after: AstFile[]; context: MrContext }> {
  const context = await api.fetchMrContext(opts.projectId, opts.mrIid);
  // Cross-file analysis needs full-repo visibility, not just the diffed files.
  const [beforePaths, afterPaths] = await Promise.all([
    api.listStFiles(opts.projectId, context.baseSha),
    api.listStFiles(opts.projectId, context.headSha),
  ]);
  const before: AstFile[] = [];
  const after: AstFile[] = [];
  for (const path of afterPaths) {
    const src = await api.fetchFile(opts.projectId, context.headSha, path);
    if (src !== null) after.push(await parseSource(src, path));
  }
  for (const path of beforePaths) {
    const src = await api.fetchFile(opts.projectId, context.baseSha, path);
    if (src !== null) before.push(await parseSource(src, path));
  }
  return { before, after, context };
}

export interface GitlabPostOptions extends GitlabOptions {
  commentStyle: ResolvedConfig['commentStyle'];
  inlineCap?: number;
}

export interface PostReviewResult {
  created: number;
  updated: number;
  resolved: number;
  mode: 'inline' | 'summary-only';
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
      lines.push(`- \`${r.file}:${r.line}\`${r.note ? ', ' + r.note : ''}`);
    }
  }
  return lines.join('\n');
}

function renderSummaryBody(findings: Finding[], context: MrContext): string {
  const lines: string[] = [SUMMARY_MARKER, '## plc-st-review'];
  if (findings.length === 0) {
    lines.push('');
    lines.push('No semantic findings. ✅');
    return lines.join('\n');
  }
  const counts = { error: 0, warn: 0, info: 0 };
  for (const f of findings) counts[f.severity] += 1;
  lines.push('');
  lines.push(
    `**${counts.error} error${plural(counts.error)}, ${counts.warn} warning${plural(counts.warn)}, ${counts.info} info** ` +
      `on \`${context.sourceBranch}\` → \`${context.targetBranch}\` (${context.headSha.slice(0, 8)}).`,
  );
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

interface ClassifiedDiscussions {
  summary: ApiDiscussion | null;
  findings: Map<string, ApiDiscussion>;
}

function classifyExisting(discussions: ApiDiscussion[]): ClassifiedDiscussions {
  let summary: ApiDiscussion | null = null;
  const findings = new Map<string, ApiDiscussion>();
  for (const d of discussions) {
    const note = d.notes[0];
    if (!note || !note.body.startsWith(MARKER_PREFIX)) continue;
    if (note.body.startsWith(SUMMARY_MARKER)) {
      summary = d;
      continue;
    }
    const match = /key=([^\s]+)/.exec(note.body);
    if (match) findings.set(match[1], d);
  }
  return { summary, findings };
}

export async function postGitlabReview(
  findings: Finding[],
  context: MrContext,
  opts: GitlabPostOptions,
  api: GitlabApi = createGitbeakerClient(opts),
): Promise<PostReviewResult> {
  const inlineCap = opts.inlineCap ?? INLINE_CAP;
  const mode: PostReviewResult['mode'] =
    findings.length > inlineCap || opts.commentStyle === 'summary'
      ? 'summary-only'
      : 'inline';

  const existing = classifyExisting(
    await api.listDiscussions(opts.projectId, opts.mrIid),
  );

  const result: PostReviewResult = { created: 0, updated: 0, resolved: 0, mode };

  if (mode === 'inline' && opts.commentStyle !== 'summary') {
    const incoming = new Set<string>();
    for (const f of findings) {
      const key = findingKey(f);
      incoming.add(key);
      const body = renderFindingBody(f);
      const prior = existing.findings.get(key);
      if (prior) {
        if (prior.notes[0].body !== body) {
          await api.editNote(
            opts.projectId,
            opts.mrIid,
            prior.id,
            prior.notes[0].id,
            body,
          );
          result.updated += 1;
        }
      } else {
        await api.createDiscussion(opts.projectId, opts.mrIid, body, {
          baseSha: context.baseSha,
          headSha: context.headSha,
          startSha: context.startSha,
          newPath: f.file,
          oldPath: f.file,
          newLine: f.line,
        });
        result.created += 1;
      }
    }
    for (const [key, prior] of existing.findings) {
      if (incoming.has(key)) continue;
      const resolvable = prior.notes.some((n) => n.resolvable && !n.resolved);
      if (!resolvable) continue;
      await api.resolveDiscussion(opts.projectId, opts.mrIid, prior.id);
      result.resolved += 1;
    }
  }

  if (opts.commentStyle !== 'inline' || mode === 'summary-only') {
    const body = renderSummaryBody(findings, context);
    if (existing.summary) {
      if (existing.summary.notes[0].body !== body) {
        await api.editNote(
          opts.projectId,
          opts.mrIid,
          existing.summary.id,
          existing.summary.notes[0].id,
          body,
        );
        result.updated += 1;
      }
    } else {
      await api.createDiscussion(opts.projectId, opts.mrIid, body);
      result.created += 1;
    }
  }

  return result;
}

export function resolveGitlabOptionsFromEnv(
  override: Partial<GitlabOptions>,
): GitlabOptions {
  const token =
    override.token ??
    process.env.GITLAB_TOKEN ??
    process.env.CI_JOB_TOKEN ??
    null;
  if (!token) {
    throw new Error('GITLAB_TOKEN or CI_JOB_TOKEN must be set');
  }
  const host =
    override.host ??
    process.env.GITLAB_URL ??
    process.env.CI_SERVER_URL ??
    'https://gitlab.com';
  const projectId =
    override.projectId ??
    process.env.GITLAB_PROJECT_ID ??
    process.env.CI_PROJECT_ID ??
    null;
  if (projectId === null || projectId === '') {
    throw new Error('GITLAB_PROJECT_ID or CI_PROJECT_ID must be set');
  }
  const mrIid = override.mrIid;
  if (mrIid === undefined) {
    throw new Error('--mr <iid> must be provided');
  }
  return { token, host, projectId, mrIid };
}
