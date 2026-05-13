import { describe, expect, it } from 'vitest';
import {
  commentNode,
  fbDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('COMMENTED_OUT_CODE', () => {
  it('flags a comment that contains an assignment', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [commentNode('(* xEnable := TRUE; *)')] }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'COMMENTED_OUT_CODE');
    expect(f).toHaveLength(1);
  });

  it('does not flag a plain prose comment', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [commentNode('(* Wait for the operator to confirm. *)')] }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'COMMENTED_OUT_CODE')).toHaveLength(0);
  });
});
