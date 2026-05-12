import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  invocation,
  localVars,
  paramDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('EDGE_TRIG_REUSED', () => {
  it('flags an R_TRIG fed by two different CLK expressions', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'rTrig1', type: 'R_TRIG' })),
          invocation('rTrig1', { CLK: 'xButton' }),
          invocation('rTrig1', { CLK: 'xSensor' }),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'EDGE_TRIG_REUSED');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('R_TRIG');
    expect(f[0].summary).toContain('rTrig1');
  });

  it('does not flag an R_TRIG fed by a single CLK', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'rTrig1', type: 'R_TRIG' })),
          invocation('rTrig1', { CLK: 'xButton' }),
          invocation('rTrig1', { CLK: 'xButton' }),
        ],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'EDGE_TRIG_REUSED')).toHaveLength(0);
  });
});
