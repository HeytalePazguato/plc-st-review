import { describe, expect, it } from 'vitest';
import { fbDecl, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('UNUSED_INPUT_VAR', () => {
  it('flags a new VAR_INPUT never referenced inside the FB', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { inputs: [{ name: 'xUnused', type: 'BOOL' }] }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'UNUSED_INPUT_VAR');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('xUnused');
  });
});
