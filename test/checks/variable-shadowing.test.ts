import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  globalsBlock,
  localVars,
  paramDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('VARIABLE_SHADOWING', () => {
  it('flags a local that shadows a global', () => {
    resetLines();
    const before = sourceFile('G.st', [
      globalsBlock([{ name: 'gFlow', type: 'REAL', initial: '0.0' }]),
    ]);
    resetLines();
    const beforeFb = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [localVars({}, paramDecl({ name: 'gFlow', type: 'REAL' }))] }),
    ]);
    const findings = review([before, beforeFb], [before, after]);
    const f = findings.filter((x) => x.category === 'VARIABLE_SHADOWING');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('gFlow');
  });
});
