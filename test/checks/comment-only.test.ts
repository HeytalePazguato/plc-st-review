import { describe, expect, it } from 'vitest';
import { fbDecl, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('COMMENT_ONLY', () => {
  it('flags identical-structure files whose source text differs', () => {
    resetLines();
    const before = sourceFile(
      'FB_Steady.st',
      [fbDecl('FB_Steady', { inputs: [{ name: 'xEnable', type: 'BOOL' }] })],
      'FUNCTION_BLOCK FB_Steady\n(* old comment *)\nEND_FUNCTION_BLOCK',
    );
    resetLines();
    const after = sourceFile(
      'FB_Steady.st',
      [fbDecl('FB_Steady', { inputs: [{ name: 'xEnable', type: 'BOOL' }] })],
      'FUNCTION_BLOCK FB_Steady\n(* new comment *)\nEND_FUNCTION_BLOCK',
    );
    const findings = review([before], [after]);
    const co = findings.filter((f) => f.category === 'COMMENT_ONLY');
    expect(co).toHaveLength(1);
    expect(co[0].severity).toBe('info');
  });

  it('does not flag when the source is byte-identical', () => {
    resetLines();
    const sameSource = 'FUNCTION_BLOCK FB_Steady\nEND_FUNCTION_BLOCK';
    const before = sourceFile(
      'FB_Steady.st',
      [fbDecl('FB_Steady', { inputs: [{ name: 'xEnable', type: 'BOOL' }] })],
      sameSource,
    );
    resetLines();
    const after = sourceFile(
      'FB_Steady.st',
      [fbDecl('FB_Steady', { inputs: [{ name: 'xEnable', type: 'BOOL' }] })],
      sameSource,
    );
    const findings = review([before], [after]);
    expect(findings.filter((f) => f.category === 'COMMENT_ONLY')).toHaveLength(0);
  });
});
