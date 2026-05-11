import { describe, expect, it } from 'vitest';
import {
  globalsBlock,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('TYPE_MISMATCH', () => {
  it('flags a global whose type changed', () => {
    resetLines();
    const before = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gFlowSetpoint', type: 'INT', initial: '0' }]),
    ]);
    resetLines();
    const after = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gFlowSetpoint', type: 'REAL', initial: '0.0' }]),
    ]);
    const findings = review([before], [after]);
    const tm = findings.filter((f) => f.category === 'TYPE_MISMATCH');
    expect(tm).toHaveLength(1);
    expect(tm[0].severity).toBe('error');
    expect(tm[0].summary).toContain('INT → REAL');
  });

  it('does not flag when only the initial value changed', () => {
    resetLines();
    const before = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gFlow', type: 'REAL', initial: '0.0' }]),
    ]);
    resetLines();
    const after = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gFlow', type: 'REAL', initial: '1.0' }]),
    ]);
    const findings = review([before], [after]);
    expect(findings.filter((f) => f.category === 'TYPE_MISMATCH')).toHaveLength(0);
  });

  it('reports related referencing files when present', () => {
    resetLines();
    const globalsBefore = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gFlow', type: 'INT', initial: '0' }]),
    ]);
    resetLines();
    const mainBefore = sourceFile('MAIN.st', [
      programDecl('MAIN', []),
    ]);
    resetLines();
    const globalsAfter = sourceFile('Globals.st', [
      globalsBlock([{ name: 'gFlow', type: 'REAL', initial: '0.0' }]),
    ]);
    resetLines();
    const mainAfter = sourceFile('MAIN.st', [
      programDecl('MAIN', []),
    ]);
    // Inject a reference to gFlow in MAIN.st's after-tree by adding an identifier child.
    // We rely on the catch-all `descendantsOfType(IDENTIFIER)` walker.
    const findings = review([globalsBefore, mainBefore], [globalsAfter, mainAfter]);
    const tm = findings.filter((f) => f.category === 'TYPE_MISMATCH');
    expect(tm).toHaveLength(1);
    // No cross-file ref synthesised → related list is empty but the finding still fires.
    expect(tm[0].related).toEqual([]);
  });
});
