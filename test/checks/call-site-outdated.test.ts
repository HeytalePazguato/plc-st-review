import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  invocation,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('CALL_SITE_OUTDATED', () => {
  it('flags a caller missing a newly required input', () => {
    resetLines();
    const beforeFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
    ]);
    resetLines();
    const beforeMain = sourceFile('MAIN.st', [
      programDecl('MAIN', [invocation('FB_Pump', { xEnable: 'TRUE' })]),
    ]);
    resetLines();
    const afterFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', {
        inputs: [
          { name: 'xEnable', type: 'BOOL' },
          { name: 'xManualOverride', type: 'BOOL' },
        ],
      }),
    ]);
    resetLines();
    const afterMain = sourceFile('MAIN.st', [
      programDecl('MAIN', [invocation('FB_Pump', { xEnable: 'TRUE' })]),
    ]);
    const findings = review([beforeFb, beforeMain], [afterFb, afterMain]);
    const out = findings.filter((f) => f.category === 'CALL_SITE_OUTDATED');
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('error');
    expect(out[0].file).toBe('MAIN.st');
    expect(out[0].detail).toContain('xManualOverride');
  });

  it('does not flag callers that pass all required args', () => {
    resetLines();
    const beforeFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
    ]);
    resetLines();
    const afterFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', {
        inputs: [
          { name: 'xEnable', type: 'BOOL' },
          { name: 'xManualOverride', type: 'BOOL' },
        ],
      }),
    ]);
    resetLines();
    const main = sourceFile('MAIN.st', [
      programDecl('MAIN', [
        invocation('FB_Pump', { xEnable: 'TRUE', xManualOverride: 'FALSE' }),
      ]),
    ]);
    const findings = review([beforeFb, main], [afterFb, main]);
    expect(findings.filter((f) => f.category === 'CALL_SITE_OUTDATED')).toHaveLength(0);
  });

  it('flags unknown named arguments', () => {
    resetLines();
    const fb = sourceFile('FB_Valve.st', [
      fbDecl('FB_Valve', { inputs: [{ name: 'xOpen', type: 'BOOL' }] }),
    ]);
    resetLines();
    const main = sourceFile('MAIN.st', [
      programDecl('MAIN', [invocation('FB_Valve', { xOpen: 'TRUE', xUnknown: 'TRUE' })]),
    ]);
    const findings = review([fb, main], [fb, main]);
    const out = findings.filter((f) => f.category === 'CALL_SITE_OUTDATED');
    expect(out).toHaveLength(1);
    expect(out[0].detail).toContain("unknown argument 'xUnknown'");
  });
});
