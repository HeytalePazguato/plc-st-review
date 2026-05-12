import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  forStatement,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('LOOP_BOUNDS_REVERSED', () => {
  it('flags positive step with start > end', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [forStatement({ loopVar: 'i', start: '10', end: '5' })],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'LOOP_BOUNDS_REVERSED');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('start (10) > end (5)');
  });

  it('flags negative step with start < end', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [forStatement({ loopVar: 'i', start: '1', end: '10', by: '-1' })],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'LOOP_BOUNDS_REVERSED');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('negative step (-1)');
  });

  it('does not flag normal loop directions', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [forStatement({ loopVar: 'i', start: '1', end: '10' })],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'LOOP_BOUNDS_REVERSED')).toHaveLength(0);
  });
});
