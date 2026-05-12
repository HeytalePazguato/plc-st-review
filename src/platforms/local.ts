import { readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { parseSource } from '../engine/parse.js';
import type { AstFile } from '../engine/types.js';

const ST_EXTENSIONS = new Set<string>(['.st', '.ST', '.iecst', '.IECST']);

export interface DiffRefsOptions {
  base: string;
  head: string;
  repoRoot?: string;
  paths?: string[];
}

export async function loadRefSnapshot(
  opts: DiffRefsOptions,
): Promise<{ before: AstFile[]; after: AstFile[] }> {
  const cwd = opts.repoRoot ?? process.cwd();
  const git: SimpleGit = simpleGit(cwd);

  const diffSummary = await git.diff([
    '--name-only',
    '--diff-filter=ACMRTUX',
    `${opts.base}...${opts.head}`,
  ]);
  const allChanged = diffSummary
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const candidates = allChanged.filter((p) => ST_EXTENSIONS.has(extname(p)));
  const filtered = opts.paths?.length
    ? candidates.filter((p) => opts.paths!.some((q) => p.includes(q)))
    : candidates;

  const before: AstFile[] = [];
  const after: AstFile[] = [];

  for (const relPath of filtered) {
    const beforeSrc = await safeShowFile(git, opts.base, relPath);
    if (beforeSrc !== null) {
      before.push(await parseSource(beforeSrc, relPath));
    }
    const afterSrc = await safeShowFile(git, opts.head, relPath);
    if (afterSrc !== null) {
      after.push(await parseSource(afterSrc, relPath));
    }
  }
  return { before, after };
}

async function safeShowFile(
  git: SimpleGit,
  ref: string,
  path: string,
): Promise<string | null> {
  try {
    return await git.show([`${ref}:${path}`]);
  } catch {
    return null;
  }
}

export async function loadPathPair(
  beforePath: string,
  afterPath: string,
): Promise<{ before: AstFile[]; after: AstFile[] }> {
  const beforeAbs = resolve(beforePath);
  const afterAbs = resolve(afterPath);
  const beforeSrc = await readFile(beforeAbs, 'utf8');
  const afterSrc = await readFile(afterAbs, 'utf8');
  // Both files should report under the same logical path so the engine pairs them.
  const sharedPath = relative(process.cwd(), afterAbs);
  return {
    before: [await parseSource(beforeSrc, sharedPath)],
    after: [await parseSource(afterSrc, sharedPath)],
  };
}
