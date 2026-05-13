import { describe, expect, it } from 'vitest';
import {
  bareIdentifier,
  fbDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('FORBIDDEN_SYMBOL', () => {
  it('flags a reference to a configured forbidden identifier', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [bareIdentifier('DangerousLegacyApi')] }),
    ]);
    const findings = review([before], [after], {
      forbiddenSymbols: ['DangerousLegacyApi'],
    });
    const f = findings.filter((x) => x.category === 'FORBIDDEN_SYMBOL');
    expect(f).toHaveLength(1);
  });

  it('returns no findings when no patterns are configured', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [bareIdentifier('AnythingGoes')] }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'FORBIDDEN_SYMBOL')).toHaveLength(0);
  });

  it('matches regex patterns inside slashes', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [bareIdentifier('OldThing')] }),
    ]);
    const findings = review([before], [after], {
      forbiddenSymbols: ['/^Old/'],
    });
    expect(findings.filter((x) => x.category === 'FORBIDDEN_SYMBOL')).toHaveLength(1);
  });
});
