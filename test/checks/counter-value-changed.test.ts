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

function buildFb(name: string, pv: string) {
  resetLines();
  return fbDecl(name, {
    locals: [
      localVars({}, paramDecl({ name: 'C1', type: 'CTU' })),
      invocation('C1', { CU: 'TRUE', PV: pv }),
    ],
  });
}

describe('COUNTER_VALUE_CHANGED', () => {
  it('flags a 10x PV increase as error', () => {
    const before = sourceFile('FB.st', [buildFb('FB', '10')]);
    const after = sourceFile('FB.st', [buildFb('FB', '100')]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'COUNTER_VALUE_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
    expect(f[0].summary).toContain('10 → 100');
  });

  it('flags a 3x change as warn', () => {
    const before = sourceFile('FB.st', [buildFb('FB', '10')]);
    const after = sourceFile('FB.st', [buildFb('FB', '30')]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'COUNTER_VALUE_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('warn');
  });
});
