import { describe, expect, it } from 'vitest';
import { fbDecl, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('INHERITANCE_CHANGED', () => {
  it('flags an added EXTENDS clause', () => {
    resetLines();
    const before = sourceFile('FB_D.st', [fbDecl('FB_D', {})]);
    resetLines();
    const after = sourceFile('FB_D.st', [fbDecl('FB_D', { extends: 'FB_Base' })]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'INHERITANCE_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('added');
    expect(f[0].summary).toContain('FB_Base');
  });

  it('flags a changed EXTENDS clause', () => {
    resetLines();
    const before = sourceFile('FB_D.st', [fbDecl('FB_D', { extends: 'FB_A' })]);
    resetLines();
    const after = sourceFile('FB_D.st', [fbDecl('FB_D', { extends: 'FB_B' })]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'INHERITANCE_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('FB_A');
    expect(f[0].summary).toContain('FB_B');
  });

  it('does not flag identical EXTENDS', () => {
    resetLines();
    const before = sourceFile('FB_D.st', [fbDecl('FB_D', { extends: 'FB_Base' })]);
    resetLines();
    const after = sourceFile('FB_D.st', [fbDecl('FB_D', { extends: 'FB_Base' })]);
    const findings = review([before], [after]);
    expect(findings.filter((x) => x.category === 'INHERITANCE_CHANGED')).toHaveLength(0);
  });
});
