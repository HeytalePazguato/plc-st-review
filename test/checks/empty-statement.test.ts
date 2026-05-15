import { describe, expect, it } from 'vitest';
import {
  emptyStmt,
  fbDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('EMPTY_STATEMENT', () => {
  it('flags a new empty statement', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [fbDecl('FB', { locals: [emptyStmt()] })]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'EMPTY_STATEMENT');
    expect(f).toHaveLength(1);
  });

  it('does not flag pre-existing empty statements', () => {
    resetLines();
    const both = sourceFile('FB.st', [fbDecl('FB', { locals: [emptyStmt()] })]);
    const findings = review([both], [both]);
    expect(findings.filter((x) => x.category === 'EMPTY_STATEMENT')).toHaveLength(0);
  });
});
