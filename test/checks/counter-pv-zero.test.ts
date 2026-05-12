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

describe('COUNTER_PV_ZERO', () => {
  it('flags a CTU with PV := 0', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'C1', type: 'CTU' })),
          invocation('C1', { CU: 'TRUE', PV: '0' }),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'COUNTER_PV_ZERO');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
  });

  it('does not flag a counter with positive PV', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'C1', type: 'CTU' })),
          invocation('C1', { CU: 'TRUE', PV: '10' }),
        ],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'COUNTER_PV_ZERO')).toHaveLength(0);
  });
});
