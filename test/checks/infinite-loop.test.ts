import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  resetLines,
  sourceFile,
  whileStatement,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('INFINITE_LOOP', () => {
  it('flags WHILE TRUE without an EXIT statement', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [whileStatement('TRUE')] }),
    ]);
    const findings = review([before], [after]);
    const i = findings.filter((f) => f.category === 'INFINITE_LOOP');
    expect(i).toHaveLength(1);
    expect(i[0].severity).toBe('error');
  });

  it('does not flag WHILE TRUE that contains an EXIT', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [whileStatement('TRUE', { hasExit: true })] }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((f) => f.category === 'INFINITE_LOOP')).toHaveLength(0);
  });

  it('does not flag WHILE with a non-trivial condition', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [whileStatement('xRunning')] }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((f) => f.category === 'INFINITE_LOOP')).toHaveLength(0);
  });
});
