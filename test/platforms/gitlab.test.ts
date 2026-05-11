import { describe, expect, it } from 'vitest';
import {
  loadGitlabMrSnapshot,
  postGitlabReview,
  resolveGitlabOptionsFromEnv,
  type ApiDiscussion,
  type GitlabApi,
  type GitlabOptions,
  type GitlabPostOptions,
  type InlinePosition,
  type MrContext,
} from '../../src/platforms/gitlab.js';
import type { Finding } from '../../src/engine/types.js';

interface FakeApiState {
  context: MrContext;
  files: Map<string, string>; // `${ref}::${path}` -> source
  discussions: ApiDiscussion[];
  log: Array<
    | { kind: 'create'; body: string; position?: InlinePosition }
    | { kind: 'edit'; discussionId: string; noteId: number; body: string }
    | { kind: 'resolve'; discussionId: string }
  >;
}

function fakeApi(state: FakeApiState): GitlabApi {
  return {
    async fetchMrContext() {
      return state.context;
    },
    async fetchFile(_p, ref, path) {
      return state.files.get(`${ref}::${path}`) ?? null;
    },
    async listDiscussions() {
      return state.discussions.map((d) => ({
        id: d.id,
        notes: d.notes.map((n) => ({ ...n })),
      }));
    },
    async createDiscussion(_p, _m, body, position) {
      state.log.push({ kind: 'create', body, position });
    },
    async editNote(_p, _m, discussionId, noteId, body) {
      state.log.push({ kind: 'edit', discussionId, noteId, body });
    },
    async resolveDiscussion(_p, _m, discussionId) {
      state.log.push({ kind: 'resolve', discussionId });
    },
  };
}

const baseContext: MrContext = {
  baseSha: 'baaaaaa',
  headSha: 'heeeeead',
  startSha: 'staaaart',
  targetBranch: 'main',
  sourceBranch: 'feature/x',
  changes: [],
};

const opts: GitlabOptions = {
  token: 'x',
  host: 'https://gitlab.example.com',
  projectId: 42,
  mrIid: 17,
};

describe('resolveGitlabOptionsFromEnv', () => {
  it('reads env vars and overrides', () => {
    process.env.GITLAB_TOKEN = 'tok';
    process.env.GITLAB_PROJECT_ID = '99';
    const resolved = resolveGitlabOptionsFromEnv({ mrIid: 5 });
    expect(resolved.token).toBe('tok');
    expect(resolved.projectId).toBe('99');
    expect(resolved.host).toBe('https://gitlab.com');
    expect(resolved.mrIid).toBe(5);
    delete process.env.GITLAB_TOKEN;
    delete process.env.GITLAB_PROJECT_ID;
  });

  it('throws without a token', () => {
    delete process.env.GITLAB_TOKEN;
    delete process.env.CI_JOB_TOKEN;
    expect(() => resolveGitlabOptionsFromEnv({ projectId: 1, mrIid: 1 })).toThrow(
      /GITLAB_TOKEN/,
    );
  });
});

describe('loadGitlabMrSnapshot', () => {
  it('filters to .st files and fetches both revisions', async () => {
    const state: FakeApiState = {
      context: {
        ...baseContext,
        changes: [
          { oldPath: 'FB_Pump.st', newPath: 'FB_Pump.st', renamedFile: false, deletedFile: false, newFile: false },
          { oldPath: 'README.md', newPath: 'README.md', renamedFile: false, deletedFile: false, newFile: false },
          { oldPath: 'NEW.st', newPath: 'NEW.st', renamedFile: false, deletedFile: false, newFile: true },
        ],
      },
      files: new Map([
        ['baaaaaa::FB_Pump.st', 'FUNCTION_BLOCK FB_Pump\nEND_FUNCTION_BLOCK\n'],
        ['heeeeead::FB_Pump.st', 'FUNCTION_BLOCK FB_Pump\nEND_FUNCTION_BLOCK\n'],
        ['heeeeead::NEW.st', 'FUNCTION_BLOCK NEW\nEND_FUNCTION_BLOCK\n'],
      ]),
      discussions: [],
      log: [],
    };
    const { before, after } = await loadGitlabMrSnapshot(opts, fakeApi(state));
    expect(before.map((f) => f.path)).toEqual(['FB_Pump.st']);
    expect(after.map((f) => f.path).sort()).toEqual(['FB_Pump.st', 'NEW.st']);
  });

  it('skips deleted file in after-snapshot', async () => {
    const state: FakeApiState = {
      context: {
        ...baseContext,
        changes: [
          { oldPath: 'Old.st', newPath: 'Old.st', renamedFile: false, deletedFile: true, newFile: false },
        ],
      },
      files: new Map([['baaaaaa::Old.st', 'FUNCTION_BLOCK Old\nEND_FUNCTION_BLOCK\n']]),
      discussions: [],
      log: [],
    };
    const { before, after } = await loadGitlabMrSnapshot(opts, fakeApi(state));
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(0);
  });
});

const findings: Finding[] = [
  {
    severity: 'error',
    category: 'CALL_SITE_OUTDATED',
    file: 'MAIN.st',
    line: 12,
    summary: 'Call to FB_Pump is out of date',
    detail: 'Missing xManualOverride',
  },
  {
    severity: 'warn',
    category: 'TIMER_VALUE_CHANGED',
    file: 'FB_Startup.st',
    line: 42,
    summary: 'Timer T_Delay.PT: T#5s → T#500ms',
  },
];

const postOpts: GitlabPostOptions = { ...opts, commentStyle: 'inline' };

describe('postGitlabReview', () => {
  it('creates one discussion per finding when nothing exists yet', async () => {
    const state: FakeApiState = {
      context: baseContext,
      files: new Map(),
      discussions: [],
      log: [],
    };
    const result = await postGitlabReview(findings, baseContext, postOpts, fakeApi(state));
    expect(result.mode).toBe('inline');
    expect(result.created).toBe(2);
    expect(result.updated).toBe(0);
    expect(state.log.filter((e) => e.kind === 'create')).toHaveLength(2);
    for (const entry of state.log) {
      if (entry.kind === 'create') {
        expect(entry.body).toMatch(/^<!-- plc-st-review:v1 kind=finding/);
        expect(entry.position?.newPath).toBeDefined();
      }
    }
  });

  it('updates an existing discussion when body changed', async () => {
    const key = 'CALL_SITE_OUTDATED|MAIN.st|12';
    const state: FakeApiState = {
      context: baseContext,
      files: new Map(),
      discussions: [
        {
          id: 'disc-1',
          notes: [
            {
              id: 100,
              body: `<!-- plc-st-review:v1 kind=finding key=${key} -->\nold body`,
              resolvable: true,
              resolved: false,
            },
          ],
        },
      ],
      log: [],
    };
    const result = await postGitlabReview([findings[0]], baseContext, postOpts, fakeApi(state));
    expect(result.created).toBe(0);
    expect(result.updated).toBe(1);
    const edits = state.log.filter((e) => e.kind === 'edit');
    expect(edits).toHaveLength(1);
  });

  it('resolves discussions whose findings no longer apply', async () => {
    const staleKey = 'CALL_SITE_OUTDATED|Other.st|5';
    const state: FakeApiState = {
      context: baseContext,
      files: new Map(),
      discussions: [
        {
          id: 'disc-stale',
          notes: [
            {
              id: 200,
              body: `<!-- plc-st-review:v1 kind=finding key=${staleKey} -->\nold finding`,
              resolvable: true,
              resolved: false,
            },
          ],
        },
      ],
      log: [],
    };
    await postGitlabReview([findings[0]], baseContext, postOpts, fakeApi(state));
    const resolves = state.log.filter((e) => e.kind === 'resolve');
    expect(resolves).toHaveLength(1);
    expect((resolves[0] as { discussionId: string }).discussionId).toBe('disc-stale');
  });

  it('falls back to summary-only mode when findings exceed the cap', async () => {
    const many: Finding[] = Array.from({ length: 5 }, (_, i) => ({
      severity: 'info',
      category: 'COMMENT_ONLY',
      file: `F${i}.st`,
      line: 1,
      summary: `noop ${i}`,
    }));
    const state: FakeApiState = {
      context: baseContext,
      files: new Map(),
      discussions: [],
      log: [],
    };
    const result = await postGitlabReview(many, baseContext, { ...postOpts, inlineCap: 3 }, fakeApi(state));
    expect(result.mode).toBe('summary-only');
    const creates = state.log.filter((e) => e.kind === 'create');
    expect(creates).toHaveLength(1);
    expect((creates[0] as { body: string }).body).toContain('plc-st-review');
    expect((creates[0] as { body: string }).body).toContain('| Severity |');
  });

  it('honors commentStyle=summary by skipping inline notes', async () => {
    const state: FakeApiState = {
      context: baseContext,
      files: new Map(),
      discussions: [],
      log: [],
    };
    const result = await postGitlabReview(findings, baseContext, { ...postOpts, commentStyle: 'summary' }, fakeApi(state));
    expect(result.mode).toBe('summary-only');
    expect(result.created).toBe(1);
  });
});
