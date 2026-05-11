import { describe, expect, it } from 'vitest';
import { fbDecl, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('POU_RENAMED', () => {
  it('flags a deleted/added FB pair with identical signatures', () => {
    resetLines();
    const before = sourceFile('FB_Old.st', [
      fbDecl('FB_Old', {
        inputs: [
          { name: 'xEnable', type: 'BOOL' },
          { name: 'rSetpoint', type: 'REAL' },
        ],
        outputs: [{ name: 'xDone', type: 'BOOL' }],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_New.st', [
      fbDecl('FB_New', {
        inputs: [
          { name: 'xEnable', type: 'BOOL' },
          { name: 'rSetpoint', type: 'REAL' },
        ],
        outputs: [{ name: 'xDone', type: 'BOOL' }],
      }),
    ]);
    const findings = review([before], [after]);
    const renamed = findings.filter((f) => f.category === 'POU_RENAMED');
    expect(renamed).toHaveLength(1);
    expect(renamed[0].summary).toContain('FB_Old');
    expect(renamed[0].summary).toContain('FB_New');
  });

  it('does not flag pairs with different signatures', () => {
    resetLines();
    const before = sourceFile('FB_Old.st', [
      fbDecl('FB_Old', { inputs: [{ name: 'a', type: 'INT' }] }),
    ]);
    resetLines();
    const after = sourceFile('FB_New.st', [
      fbDecl('FB_New', { inputs: [{ name: 'b', type: 'REAL' }] }),
    ]);
    const findings = review([before], [after]);
    expect(findings.filter((f) => f.category === 'POU_RENAMED')).toHaveLength(0);
  });
});
