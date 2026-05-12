import { describe, expect, it } from 'vitest';
import {
  divisionExpr,
  fbDecl,
  globalsBlock,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('DIVISION_BY_ZERO', () => {
  it('flags a literal division by zero', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [divisionExpr('rResult', '0')] }),
    ]);
    const findings = review([before], [after]);
    const d = findings.filter((f) => f.category === 'DIVISION_BY_ZERO');
    expect(d).toHaveLength(1);
    expect(d[0].summary).toContain('divisor: 0');
  });

  it('flags division by a constant that resolves to zero', () => {
    resetLines();
    const globals = sourceFile('G.st', [
      globalsBlock([{ name: 'cZero', type: 'INT', initial: '0', constant: true }]),
    ]);
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [divisionExpr('rResult', 'cZero')] }),
    ]);
    const findings = review([globals, before], [globals, after]);
    const d = findings.filter((f) => f.category === 'DIVISION_BY_ZERO');
    expect(d).toHaveLength(1);
    expect(d[0].summary).toContain('cZero');
  });

  it('does not flag division by non-zero constants', () => {
    resetLines();
    const globals = sourceFile('G.st', [
      globalsBlock([{ name: 'cThree', type: 'INT', initial: '3', constant: true }]),
    ]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [divisionExpr('rResult', 'cThree')] }),
    ]);
    const findings = review([globals, after], [globals, after]);
    expect(findings.filter((f) => f.category === 'DIVISION_BY_ZERO')).toHaveLength(0);
  });
});
