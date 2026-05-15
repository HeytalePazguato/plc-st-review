import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  invocation,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('RECURSIVE_CALL', () => {
  it('flags an FB that invokes itself', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('Recur', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('Recur', { locals: [invocation('Recur', {})] }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'RECURSIVE_CALL');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('Recur');
  });
});
