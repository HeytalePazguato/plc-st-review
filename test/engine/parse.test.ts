import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSource } from '../../src/engine/parse.js';

describe('parseSource size guard (S6)', () => {
  let stderr: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });
  afterEach(() => {
    stderr.mockRestore();
  });

  it('skips a source over the size cap and returns an empty AST', async () => {
    // 1_000_001 characters — one past the hard cap.
    const huge = 'A'.repeat(1_000_001);
    const ast = await parseSource(huge, 'huge.st');
    // The stub root has no children so checks treat it as a no-op file.
    expect(ast.root.type).toBe('source_file');
    expect(ast.root.children).toEqual([]);
    expect(ast.source).toBe('');
    // A warning naming the path is written so the user sees what was skipped.
    expect(stderr).toHaveBeenCalled();
    const msg = (stderr.mock.calls[0][0] as string) ?? '';
    expect(msg).toContain('huge.st');
    expect(msg).toContain('skipping');
  });

  it('parses normally for sources at or under the cap', async () => {
    // A short but valid FB so the real parser actually runs.
    const ast = await parseSource(
      'FUNCTION_BLOCK FB_X\nEND_FUNCTION_BLOCK\n',
      'small.st',
    );
    expect(ast.root.type).toBe('source_file');
    expect(stderr).not.toHaveBeenCalled();
  });
});
