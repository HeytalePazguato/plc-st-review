import { describe, expect, it } from 'vitest';
import { globalsBlock, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('CONSTANT_VALUE_CHANGED', () => {
  it('flags a non-critical constant change at info', () => {
    resetLines();
    const before = sourceFile('Globals.st', [
      globalsBlock([{ name: 'cCycleMs', type: 'INT', initial: '100', constant: true }]),
    ]);
    resetLines();
    const after = sourceFile('Globals.st', [
      globalsBlock([{ name: 'cCycleMs', type: 'INT', initial: '200', constant: true }]),
    ]);
    const findings = review([before], [after]);
    const cv = findings.filter((f) => f.category === 'CONSTANT_VALUE_CHANGED');
    expect(cv).toHaveLength(1);
    expect(cv[0].severity).toBe('info');
    expect(cv[0].summary).toContain('100 → 200');
  });

  it('elevates a safety-prefixed constant change to warn', () => {
    resetLines();
    const before = sourceFile('Safety.st', [
      globalsBlock([{ name: 'SAFETY_TIMEOUT', type: 'INT', initial: '500', constant: true }]),
    ]);
    resetLines();
    const after = sourceFile('Safety.st', [
      globalsBlock([{ name: 'SAFETY_TIMEOUT', type: 'INT', initial: '1500', constant: true }]),
    ]);
    const findings = review([before], [after]);
    const cv = findings.filter((f) => f.category === 'CONSTANT_VALUE_CHANGED');
    expect(cv).toHaveLength(1);
    expect(cv[0].severity).toBe('warn');
  });

  it('does not flag non-constant globals', () => {
    resetLines();
    const before = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gCounter', type: 'INT', initial: '0' }]),
    ]);
    resetLines();
    const after = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gCounter', type: 'INT', initial: '5' }]),
    ]);
    const findings = review([before], [after]);
    expect(findings.filter((f) => f.category === 'CONSTANT_VALUE_CHANGED')).toHaveLength(0);
  });
});
