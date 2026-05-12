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

describe('TIMER_PT_ZERO', () => {
  it('flags a TON with PT := T#0s', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          invocation('T1', { IN: 'TRUE', PT: 'T#0s' }),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'TIMER_PT_ZERO');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
  });

  it('does not flag positive PT', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          invocation('T1', { IN: 'TRUE', PT: 'T#5s' }),
        ],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'TIMER_PT_ZERO')).toHaveLength(0);
  });
});
