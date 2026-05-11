import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  forStatement,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('LOOP_BOUNDS_CHANGED', () => {
  it('flags a 10x iteration count increase as warn', () => {
    resetLines();
    const before = sourceFile('FB_Loop.st', [
      fbDecl('FB_Loop', {
        locals: [forStatement({ loopVar: 'i', start: '1', end: '10' })],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Loop.st', [
      fbDecl('FB_Loop', {
        locals: [forStatement({ loopVar: 'i', start: '1', end: '100' })],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'LOOP_BOUNDS_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('warn');
  });

  it('flags a small change as info', () => {
    resetLines();
    const before = sourceFile('FB_Loop.st', [
      fbDecl('FB_Loop', {
        locals: [forStatement({ loopVar: 'i', start: '1', end: '10' })],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Loop.st', [
      fbDecl('FB_Loop', {
        locals: [forStatement({ loopVar: 'i', start: '1', end: '12' })],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'LOOP_BOUNDS_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('info');
  });
});
