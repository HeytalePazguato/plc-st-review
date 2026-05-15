import { describe, expect, it } from 'vitest';
import {
  fnDecl,
  invocation,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('UNUSED_RETURN_VALUE', () => {
  it('flags a function call whose return is discarded', () => {
    resetLines();
    const fn = sourceFile('F.st', [fnDecl('Compute', 'INT', {})]);
    resetLines();
    const before = sourceFile('MAIN.st', [programDecl('MAIN', [])]);
    resetLines();
    const after = sourceFile('MAIN.st', [
      programDecl('MAIN', [invocation('Compute', {})]),
    ]);
    const findings = review([fn, before], [fn, after]);
    const f = findings.filter((x) => x.category === 'UNUSED_RETURN_VALUE');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('Compute');
  });
});
