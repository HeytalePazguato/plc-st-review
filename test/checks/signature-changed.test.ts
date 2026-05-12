import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('SIGNATURE_CHANGED', () => {
  it('flags a breaking input removal', () => {
    resetLines();
    const before = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', {
        inputs: [
          { name: 'xEnable', type: 'BOOL' },
          { name: 'rSetpoint', type: 'REAL' },
        ],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
    ]);
    const findings = review([before], [after]);
    const sig = findings.filter((f) => f.category === 'SIGNATURE_CHANGED');
    expect(sig).toHaveLength(1);
    expect(sig[0].severity).toBe('error');
    expect(sig[0].summary).toContain('breaking');
    expect(sig[0].detail).toContain('rSetpoint');
  });

  it('flags an additive input with a default as warn', () => {
    resetLines();
    const before = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
    ]);
    resetLines();
    const after = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', {
        inputs: [
          { name: 'xEnable', type: 'BOOL' },
          { name: 'xManualOverride', type: 'BOOL', initial: 'FALSE' },
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const sig = findings.filter((f) => f.category === 'SIGNATURE_CHANGED');
    expect(sig).toHaveLength(1);
    expect(sig[0].severity).toBe('warn');
    expect(sig[0].summary).toContain('additive');
  });

  it('flags a type-only change as error', () => {
    resetLines();
    const before = sourceFile('FB_Mixer.st', [
      fbDecl('FB_Mixer', {
        inputs: [{ name: 'rSetpoint', type: 'INT' }],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Mixer.st', [
      fbDecl('FB_Mixer', {
        inputs: [{ name: 'rSetpoint', type: 'REAL' }],
      }),
    ]);
    const findings = review([before], [after]);
    const sig = findings.filter((f) => f.category === 'SIGNATURE_CHANGED');
    expect(sig).toHaveLength(1);
    expect(sig[0].severity).toBe('error');
    expect(sig[0].detail).toContain('INT -> REAL');
  });

  it('emits nothing when the signature is unchanged', () => {
    resetLines();
    const before = sourceFile('FB_Stable.st', [
      fbDecl('FB_Stable', {
        inputs: [{ name: 'xEnable', type: 'BOOL' }],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Stable.st', [
      fbDecl('FB_Stable', {
        inputs: [{ name: 'xEnable', type: 'BOOL' }],
      }),
    ]);
    const findings = review([before], [after]);
    expect(findings.filter((f) => f.category === 'SIGNATURE_CHANGED')).toHaveLength(0);
  });
});
