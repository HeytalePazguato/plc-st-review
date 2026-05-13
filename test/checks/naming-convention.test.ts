import { describe, expect, it } from 'vitest';
import { fbDecl, resetLines, sourceFile } from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('NAMING_CONVENTION', () => {
  it('does nothing when no rules are configured', () => {
    resetLines();
    const fb = sourceFile('F.st', [fbDecl('whatever', {})]);
    const findings = review([fb], [fb]);
    expect(findings.filter((x) => x.category === 'NAMING_CONVENTION')).toHaveLength(0);
  });

  it('flags an FB whose name lacks the configured prefix', () => {
    resetLines();
    const before = sourceFile('F.st', [fbDecl('FB_Existing', {})]);
    resetLines();
    const after = sourceFile('F.st', [fbDecl('FB_Existing', {}), fbDecl('NewlyAdded', {})]);
    const findings = review([before], [after], {
      namingConventions: { function_block: { prefix: 'FB_' } },
    });
    const f = findings.filter((x) => x.category === 'NAMING_CONVENTION');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('NewlyAdded');
    expect(f[0].summary).toContain("does not start with 'FB_'");
  });

  it('respects suffix-based rules', () => {
    resetLines();
    const before = sourceFile('F.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('F.st', [fbDecl('FB', { inputs: [{ name: 'xInput', type: 'BOOL' }] })]);
    const findings = review([before], [after], {
      namingConventions: { input_var: { suffix: '_in' } },
    });
    const f = findings.filter((x) => x.category === 'NAMING_CONVENTION');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain("does not end with '_in'");
  });

  it('respects regex patterns', () => {
    resetLines();
    const before = sourceFile('F.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('F.st', [
      fbDecl('FB', { inputs: [{ name: 'sample', type: 'INT' }] }),
    ]);
    const findings = review([before], [after], {
      namingConventions: { input_var: { pattern: '^i[A-Z]' } },
    });
    expect(findings.filter((x) => x.category === 'NAMING_CONVENTION')).toHaveLength(1);
  });

  it('honors naming_ignore', () => {
    resetLines();
    const before = sourceFile('F.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('F.st', [fbDecl('FB', {}), fbDecl('LegacyFb', {})]);
    const findings = review([before], [after], {
      namingConventions: { function_block: { prefix: 'FB_' } },
      namingIgnore: ['LegacyFb'],
    });
    expect(findings.filter((x) => x.category === 'NAMING_CONVENTION')).toHaveLength(0);
  });
});
