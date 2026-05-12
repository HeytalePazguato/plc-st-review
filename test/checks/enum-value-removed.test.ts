import { describe, expect, it } from 'vitest';
import {
  caseStatement,
  enumTypeDecl,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ENUM_VALUE_REMOVED', () => {
  it('flags CASE statements still referencing a removed enum value', () => {
    resetLines();
    const before = sourceFile('Conveyor.st', [
      enumTypeDecl('E_ConveyorState', [{ name: 'IDLE' }, { name: 'RUNNING' }, { name: 'FAULT' }]),
    ]);
    resetLines();
    const beforeHmi = sourceFile('Conveyor_HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'eState',
          values: ['IDLE', 'RUNNING', 'FAULT'],
        }),
      ]),
    ]);
    resetLines();
    const after = sourceFile('Conveyor.st', [
      enumTypeDecl('E_ConveyorState', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const afterHmi = sourceFile('Conveyor_HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'eState',
          values: ['IDLE', 'RUNNING', 'FAULT'],
        }),
      ]),
    ]);
    const findings = review([before, beforeHmi], [after, afterHmi]);
    const evr = findings.filter((f) => f.category === 'ENUM_VALUE_REMOVED');
    expect(evr.length).toBeGreaterThanOrEqual(1);
    expect(evr[0].summary).toContain('FAULT');
    expect(evr[0].file).toBe('Conveyor_HMI.st');
  });
});
