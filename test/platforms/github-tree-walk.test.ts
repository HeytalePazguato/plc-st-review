import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  walkTreeForStFiles,
  type TreeEntry,
  type TreeFetcher,
} from '../../src/platforms/github.js';

interface TreeNode {
  // Map of `name` -> `{ type, sha, children? }`. `children` is required
  // when `type === 'tree'` so the walker can recurse into it.
  [name: string]: { type: 'blob' | 'tree'; sha: string; truncated?: boolean; children?: TreeNode };
}

function fakeFetcher(
  shaToNode: ReadonlyMap<string, { node: TreeNode; truncated: boolean }>,
): TreeFetcher {
  return async (sha) => {
    const found = shaToNode.get(sha);
    if (!found) throw new Error(`unexpected sha: ${sha}`);
    const tree: TreeEntry[] = Object.entries(found.node).map(([name, info]) => ({
      type: info.type,
      path: name,
      sha: info.sha,
    }));
    return { tree, truncated: found.truncated };
  };
}

describe('walkTreeForStFiles (S7 truncation fallback)', () => {
  let stderr: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    stderr.mockRestore();
  });

  it('collects .st blobs across nested subtrees', async () => {
    // Root contains: MAIN.st (blob), src/ (tree).
    //   src/ contains: FB.st (blob), helpers/ (tree).
    //     helpers/ contains: H.st (blob), README.md (blob, not .st).
    const shas = new Map<string, { node: TreeNode; truncated: boolean }>([
      [
        'rootSha',
        {
          node: {
            'MAIN.st': { type: 'blob', sha: 'b1' },
            src: { type: 'tree', sha: 'srcSha' },
          },
          truncated: false,
        },
      ],
      [
        'srcSha',
        {
          node: {
            'FB.st': { type: 'blob', sha: 'b2' },
            helpers: { type: 'tree', sha: 'helpersSha' },
          },
          truncated: false,
        },
      ],
      [
        'helpersSha',
        {
          node: {
            'H.st': { type: 'blob', sha: 'b3' },
            'README.md': { type: 'blob', sha: 'b4' },
          },
          truncated: false,
        },
      ],
    ]);
    const out = await walkTreeForStFiles('rootSha', fakeFetcher(shas));
    expect(out.sort()).toEqual(['MAIN.st', 'src/FB.st', 'src/helpers/H.st']);
  });

  it('warns when a fetched subtree is itself truncated but still returns what it found', async () => {
    const shas = new Map<string, { node: TreeNode; truncated: boolean }>([
      [
        'rootSha',
        { node: { 'A.st': { type: 'blob', sha: 'a1' } }, truncated: true },
      ],
    ]);
    const out = await walkTreeForStFiles('rootSha', fakeFetcher(shas));
    expect(out).toEqual(['A.st']);
    expect(stderr).toHaveBeenCalled();
    expect((stderr.mock.calls[0][0] as string)).toContain('truncated');
  });

  it('skips a subtree whose fetch throws, without losing what was already collected', async () => {
    const shas = new Map<string, { node: TreeNode; truncated: boolean }>([
      [
        'rootSha',
        {
          node: {
            'OK.st': { type: 'blob', sha: 'b1' },
            broken: { type: 'tree', sha: 'brokenSha' },
          },
          truncated: false,
        },
      ],
      // 'brokenSha' is intentionally missing so the fetcher throws.
    ]);
    const out = await walkTreeForStFiles('rootSha', fakeFetcher(shas));
    expect(out).toEqual(['OK.st']);
  });
});
