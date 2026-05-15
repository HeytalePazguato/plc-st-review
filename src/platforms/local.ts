import { readdirSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
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

/**
 * Build a snapshot for `--lint` mode: every path matching the given
 * patterns is parsed as the "after" state, with an empty before. The
 * engine then runs the single-revision checks against each file; the
 * CLI also adds DIFF_ONLY_CATEGORIES to the disabled-checks set so the
 * 17 diff-based categories don't produce spurious "everything is new"
 * findings.
 *
 * Patterns may be:
 *   - a literal file or directory path
 *   - a glob with `*` (single segment) or `**` (any depth)
 * Examples: `src/**\/*.st`, `lib/Pumps`, `MAIN.st`.
 *
 * Non-.st files matched by a glob are silently skipped so callers can
 * use coarse patterns like `src/**\/*` without worrying about types.
 */
export async function loadLintSnapshot(
  patterns: readonly string[],
): Promise<{ before: AstFile[]; after: AstFile[] }> {
  const paths = expandLintPatterns(patterns);
  const after: AstFile[] = [];
  for (const abs of paths) {
    const src = await readFile(abs, 'utf8');
    // Normalise to forward slashes, the engine and every downstream
    // formatter expects POSIX-style paths regardless of host OS.
    const rel = relative(process.cwd(), abs).replace(/\\/g, '/');
    after.push(await parseSource(src, rel));
  }
  return { before: [], after };
}

function expandLintPatterns(patterns: readonly string[]): string[] {
  const out = new Set<string>();
  for (const pattern of patterns) {
    for (const path of expandOne(pattern)) out.add(path);
  }
  // Stable, deterministic order: alphabetical by absolute path.
  return [...out].sort();
}

function expandOne(pattern: string): string[] {
  const abs = resolve(pattern);
  // No glob characters → treat as a literal path. If it's a directory,
  // walk it for .st files; otherwise just include it.
  if (!/[*?[]/.test(pattern)) {
    if (!exists(abs)) return [];
    if (isDir(abs)) return walkForSt(abs);
    return isStPath(abs) ? [abs] : [];
  }
  // Glob: split on the first segment containing a wildcard, walk the
  // base, then match remaining segments segment-by-segment.
  const segments = pattern.split(/[/\\]/);
  const base = segments
    .slice(0, segments.findIndex((s) => /[*?[]/.test(s)))
    .join(sep);
  const rest = segments.slice(segments.findIndex((s) => /[*?[]/.test(s)));
  const rootAbs = resolve(base.length === 0 ? '.' : base);
  if (!exists(rootAbs)) return [];
  return matchTree(rootAbs, rest);
}

function matchTree(root: string, segments: readonly string[]): string[] {
  const out: string[] = [];
  walk(root, 0);
  return out;

  function walk(dir: string, segIdx: number): void {
    if (segIdx >= segments.length) {
      // Pattern fully consumed: emit if this is an .st file.
      if (isStPath(dir)) out.push(dir);
      return;
    }
    const seg = segments[segIdx];
    if (seg === '**') {
      // ** matches zero or more directory segments. Try staying at the
      // current depth (zero match) and recursing into every subdirectory
      // (one-or-more match).
      walk(dir, segIdx + 1);
      if (!isDir(dir)) return;
      for (const entry of readdirSafe(dir)) {
        const child = join(dir, entry);
        if (isDir(child)) walk(child, segIdx);
      }
      return;
    }
    if (!isDir(dir)) return;
    const re = segmentToRegex(seg);
    for (const entry of readdirSafe(dir)) {
      if (!re.test(entry)) continue;
      const child = join(dir, entry);
      if (segIdx === segments.length - 1) {
        if (isStPath(child)) out.push(child);
      } else if (isDir(child)) {
        walk(child, segIdx + 1);
      }
    }
  }
}

function segmentToRegex(seg: string): RegExp {
  let re = '^';
  for (const ch of seg) {
    if (ch === '*') re += '[^/\\\\]*';
    else if (ch === '?') re += '[^/\\\\]';
    else re += ch.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(re + '$');
}

function walkForSt(root: string): string[] {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSafe(dir)) {
      const child = join(dir, entry);
      if (isDir(child)) stack.push(child);
      else if (isStPath(child)) out.push(child);
    }
  }
  return out;
}

function readdirSafe(dir: string): string[] {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

function exists(path: string): boolean {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isStPath(path: string): boolean {
  return ST_EXTENSIONS.has(extname(path));
}
