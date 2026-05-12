import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  localVars,
  paramDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('BISTABLE_DOMINANCE_MISMATCH', () => {
  it('flags an SR variable named like a reset-dominant latch', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [localVars({}, paramDecl({ name: 'eStopLatch', type: 'SR' }))],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'BISTABLE_DOMINANCE_MISMATCH');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('SR');
    expect(f[0].summary).toContain('RS');
  });

  it('flags an RS named like a set-dominant latch', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [localVars({}, paramDecl({ name: 'enableLatch', type: 'RS' }))],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'BISTABLE_DOMINANCE_MISMATCH');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('RS');
  });

  it('does not flag when name and dominance align', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [localVars({}, paramDecl({ name: 'eStopLatch', type: 'RS' }))],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'BISTABLE_DOMINANCE_MISMATCH')).toHaveLength(0);
  });
});
