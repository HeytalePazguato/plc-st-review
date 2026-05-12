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

describe('FB_INSTANCE_DOUBLE_CALL', () => {
  it('flags the same TON instance invoked twice in one scope', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          invocation('T1', { IN: 'xA', PT: 'T#1s' }),
          invocation('T1', { IN: 'xB', PT: 'T#1s' }),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'FB_INSTANCE_DOUBLE_CALL');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('T1');
    expect(f[0].summary).toContain('2 times');
  });

  it('does not flag a single call', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, paramDecl({ name: 'T1', type: 'TON' })),
          invocation('T1', { IN: 'xA', PT: 'T#1s' }),
        ],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'FB_INSTANCE_DOUBLE_CALL')).toHaveLength(0);
  });
});
