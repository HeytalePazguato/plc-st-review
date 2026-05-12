import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  invocation,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('POU_DELETED', () => {
  it('flags surviving callers of a deleted POU', () => {
    resetLines();
    const beforePump = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
    ]);
    resetLines();
    const beforeMain = sourceFile('MAIN.st', [
      programDecl('MAIN', [invocation('FB_Pump', { xEnable: 'TRUE' })]),
    ]);
    resetLines();
    const afterMain = sourceFile('MAIN.st', [
      programDecl('MAIN', [invocation('FB_Pump', { xEnable: 'TRUE' })]),
    ]);
    // FB_Pump.st is gone in after
    const findings = review([beforePump, beforeMain], [afterMain]);
    const deletes = findings.filter((f) => f.category === 'POU_DELETED');
    expect(deletes.length).toBeGreaterThanOrEqual(1);
    expect(deletes[0].severity).toBe('error');
    expect(deletes[0].file).toBe('MAIN.st');
  });

  it('emits warn-only when no callers reference the deleted POU', () => {
    resetLines();
    const beforePump = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
    ]);
    resetLines();
    const afterMain = sourceFile('MAIN.st', [programDecl('MAIN', [])]);
    const findings = review([beforePump], [afterMain]);
    const deletes = findings.filter((f) => f.category === 'POU_DELETED');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].severity).toBe('warn');
  });
});
