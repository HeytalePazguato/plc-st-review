import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  localVars,
  memberAccess,
  paramDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('FB_INSTANCE_NEVER_CALLED', () => {
  it('flags a TON instance whose .Q is read but no invocation exists', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          memberAccess('T1', 'Q'),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'FB_INSTANCE_NEVER_CALLED');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('T1');
  });
});
