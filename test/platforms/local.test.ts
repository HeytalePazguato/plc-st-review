import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadLintSnapshot } from '../../src/platforms/local.js';

/**
 * loadLintSnapshot turns one-or-more file paths / globs into an AST
 * snapshot with the matched files as `after` and an empty `before`.
 * The engine then runs single-revision checks against those files;
 * the CLI auto-disables the 17 DIFF_ONLY_CATEGORIES so the output is
 * clean. These tests cover the path/glob expansion in isolation.
 */
describe('loadLintSnapshot', () => {
  let root: string;
  let cwd: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'plc-st-lint-'));
    mkdirSync(join(root, 'src/lib'), { recursive: true });
    mkdirSync(join(root, 'src/programs'), { recursive: true });
    mkdirSync(join(root, 'docs'), { recursive: true });
    writeFileSync(join(root, 'src/MAIN.st'), 'FUNCTION_BLOCK FB_M\nEND_FUNCTION_BLOCK\n');
    writeFileSync(join(root, 'src/lib/A.st'), 'FUNCTION_BLOCK FB_A\nEND_FUNCTION_BLOCK\n');
    writeFileSync(
      join(root, 'src/programs/Boot.st'),
      'PROGRAM Boot\nEND_PROGRAM\n',
    );
    writeFileSync(join(root, 'docs/notes.md'), '# notes\n');
    writeFileSync(join(root, 'README.md'), '# readme\n');
    cwd = process.cwd();
    process.chdir(root);
  });
  afterEach(() => {
    process.chdir(cwd);
    rmSync(root, { recursive: true, force: true });
  });

  it('expands a single literal .st file', async () => {
    const snap = await loadLintSnapshot(['src/MAIN.st']);
    expect(snap.before).toEqual([]);
    expect(snap.after.map((a) => a.path).sort()).toEqual(['src/MAIN.st']);
  });

  it('walks a directory and picks up every .st file under it', async () => {
    const snap = await loadLintSnapshot(['src']);
    expect(snap.after.map((a) => a.path).sort()).toEqual([
      'src/MAIN.st',
      'src/lib/A.st',
      'src/programs/Boot.st',
    ]);
  });

  it('expands a `**/*.st` glob recursively', async () => {
    const snap = await loadLintSnapshot(['src/**/*.st']);
    expect(snap.after.map((a) => a.path).sort()).toEqual([
      'src/MAIN.st',
      'src/lib/A.st',
      'src/programs/Boot.st',
    ]);
  });

  it('expands a `*.st` glob with a single-segment wildcard only', async () => {
    const snap = await loadLintSnapshot(['src/*.st']);
    // src/MAIN.st matches; src/lib/A.st and src/programs/Boot.st do NOT
    // (single * doesn't cross directory boundaries).
    expect(snap.after.map((a) => a.path)).toEqual(['src/MAIN.st']);
  });

  it('silently skips non-.st files', async () => {
    const snap = await loadLintSnapshot(['docs/notes.md', 'README.md']);
    expect(snap.after).toEqual([]);
  });

  it('deduplicates overlapping patterns', async () => {
    const snap = await loadLintSnapshot([
      'src/MAIN.st',
      'src/**/*.st',
      'src/MAIN.st',
    ]);
    const paths = snap.after.map((a) => a.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.sort()).toEqual([
      'src/MAIN.st',
      'src/lib/A.st',
      'src/programs/Boot.st',
    ]);
  });

  it('returns an empty snapshot when nothing matches', async () => {
    const snap = await loadLintSnapshot(['no/such/path/**/*.st']);
    expect(snap.before).toEqual([]);
    expect(snap.after).toEqual([]);
  });
});
