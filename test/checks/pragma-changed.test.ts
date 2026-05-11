import { describe, expect, it } from 'vitest';
import { fbDecl, pragma, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('PRAGMA_CHANGED', () => {
  it('flags added and removed pragmas in the same file', () => {
    resetLines();
    const before = sourceFile('FB.st', [
      pragma("{attribute 'old'}"),
      fbDecl('FB', {}),
    ]);
    resetLines();
    const after = sourceFile('FB.st', [
      pragma("{attribute 'new'}"),
      fbDecl('FB', {}),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'PRAGMA_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].detail).toContain("'new'");
    expect(f[0].detail).toContain("'old'");
  });

  it('does not flag identical pragmas', () => {
    resetLines();
    const before = sourceFile('FB.st', [
      pragma("{attribute 'no_check'}"),
      fbDecl('FB', {}),
    ]);
    resetLines();
    const after = sourceFile('FB.st', [
      pragma("{attribute 'no_check'}"),
      fbDecl('FB', {}),
    ]);
    const findings = review([before], [after]);
    expect(findings.filter((x) => x.category === 'PRAGMA_CHANGED')).toHaveLength(0);
  });
});
