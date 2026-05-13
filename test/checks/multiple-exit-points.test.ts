import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  resetLines,
  returnStmt,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('MULTIPLE_EXIT_POINTS', () => {
  it('flags a POU that gains a second RETURN', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', { locals: [returnStmt()] })]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [returnStmt(), returnStmt()] }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'MULTIPLE_EXIT_POINTS');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('2 RETURN');
  });
});
