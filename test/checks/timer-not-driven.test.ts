import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  invocation,
  localVars,
  memberAccess,
  paramDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('TIMER_NOT_DRIVEN', () => {
  it('flags a timer whose Q is read but whose IN is never set', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          invocation('T1', { PT: 'T#5s' }), // no IN
          memberAccess('T1', 'Q'),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'TIMER_NOT_DRIVEN');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('T1');
  });

  it('does not flag a timer that is called with IN', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          invocation('T1', { IN: 'xStart', PT: 'T#5s' }),
          memberAccess('T1', 'Q'),
        ],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'TIMER_NOT_DRIVEN')).toHaveLength(0);
  });
});
