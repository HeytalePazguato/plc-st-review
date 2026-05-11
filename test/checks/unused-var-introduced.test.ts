import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  localVars,
  paramDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('UNUSED_VAR_INTRODUCED', () => {
  it('flags a new local variable that is never referenced', () => {
    resetLines();
    const before = sourceFile('FB_X.st', [
      fbDecl('FB_X', { locals: [localVars({}, paramDecl({ name: 'iUsed', type: 'INT' }))] }),
    ]);
    resetLines();
    const after = sourceFile('FB_X.st', [
      fbDecl('FB_X', {
        locals: [
          localVars(
            {},
            paramDecl({ name: 'iUsed', type: 'INT' }),
            paramDecl({ name: 'iUnused', type: 'INT' }),
          ),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const u = findings.filter((f) => f.category === 'UNUSED_VAR_INTRODUCED');
    expect(u.map((x) => x.summary).join('\n')).toContain('iUnused');
  });
});
