import { describe, expect, it } from 'vitest';
import {
  assignmentStmt,
  fbDecl,
  resetLines,
  returnStmt,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('UNREACHABLE_CODE', () => {
  it('flags a statement after RETURN that wasn’t there before', () => {
    resetLines();
    const before = sourceFile('FB_X.st', [
      fbDecl('FB_X', { locals: [returnStmt()] }),
    ]);
    resetLines();
    const after = sourceFile('FB_X.st', [
      fbDecl('FB_X', {
        locals: [returnStmt(), assignmentStmt('iCount', '99')],
      }),
    ]);
    const findings = review([before], [after]);
    const u = findings.filter((f) => f.category === 'UNREACHABLE_CODE');
    expect(u).toHaveLength(1);
    expect(u[0].summary).toContain('after RETURN');
  });

  it('does not flag pre-existing unreachable code', () => {
    resetLines();
    const fb = fbDecl('FB_X', {
      locals: [returnStmt(), assignmentStmt('iCount', '99')],
    });
    const src = sourceFile('FB_X.st', [fb]);
    const findings = review([src], [src]);
    expect(findings.filter((f) => f.category === 'UNREACHABLE_CODE')).toHaveLength(0);
  });
});
