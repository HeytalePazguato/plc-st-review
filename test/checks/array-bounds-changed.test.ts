import { describe, expect, it } from 'vitest';
import {
  arrayVarDecl,
  fbDecl,
  localVars,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ARRAY_BOUNDS_CHANGED', () => {
  it('flags an array that shrank as error', () => {
    resetLines();
    const before = sourceFile('FB_Buf.st', [
      fbDecl('FB_Buf', {
        locals: [localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' }))],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Buf.st', [
      fbDecl('FB_Buf', {
        locals: [localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '4', elementType: 'INT' }))],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'ARRAY_BOUNDS_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('error');
    expect(f[0].summary).toContain('[0..9] → [0..4]');
  });

  it('flags an array that grew as warn', () => {
    resetLines();
    const before = sourceFile('FB_Buf.st', [
      fbDecl('FB_Buf', {
        locals: [localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' }))],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Buf.st', [
      fbDecl('FB_Buf', {
        locals: [localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '19', elementType: 'INT' }))],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'ARRAY_BOUNDS_CHANGED');
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe('warn');
  });

  it('does not flag identical bounds', () => {
    resetLines();
    const before = sourceFile('FB_Buf.st', [
      fbDecl('FB_Buf', {
        locals: [localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' }))],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB_Buf.st', [
      fbDecl('FB_Buf', {
        locals: [localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' }))],
      }),
    ]);
    const findings = review([before], [after]);
    expect(findings.filter((x) => x.category === 'ARRAY_BOUNDS_CHANGED')).toHaveLength(0);
  });
});
