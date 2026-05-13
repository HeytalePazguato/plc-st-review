import { describe, expect, it } from 'vitest';
import { fbDecl, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('UNUSED_OUTPUT_VAR', () => {
  it('flags a new VAR_OUTPUT never assigned', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { outputs: [{ name: 'xDone', type: 'BOOL' }] }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'UNUSED_OUTPUT_VAR');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('xDone');
  });
});
