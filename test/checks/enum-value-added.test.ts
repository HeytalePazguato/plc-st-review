import { describe, expect, it } from 'vitest';
import {
  caseStatement,
  enumTypeDecl,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ENUM_VALUE_ADDED', () => {
  it('flags a CASE on the enum with no ELSE and no matching branch', () => {
    resetLines();
    const before = sourceFile('Conveyor.st', [
      enumTypeDecl('E_ConveyorState', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const beforeHmi = sourceFile('Conveyor_HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'E_ConveyorState',
          values: ['E_ConveyorState.IDLE', 'E_ConveyorState.RUNNING'],
        }),
      ]),
    ]);
    resetLines();
    const after = sourceFile('Conveyor.st', [
      enumTypeDecl('E_ConveyorState', [
        { name: 'IDLE' },
        { name: 'RUNNING' },
        { name: 'ERROR_RECOVERY' },
      ]),
    ]);
    resetLines();
    const afterHmi = sourceFile('Conveyor_HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'E_ConveyorState',
          values: ['E_ConveyorState.IDLE', 'E_ConveyorState.RUNNING'],
        }),
      ]),
    ]);
    const findings = review([before, beforeHmi], [after, afterHmi]);
    const eva = findings.filter((f) => f.category === 'ENUM_VALUE_ADDED');
    expect(eva.length).toBeGreaterThanOrEqual(1);
    expect(eva[0].summary).toContain('ERROR_RECOVERY');
  });

  it('does not flag if the CASE has an ELSE clause', () => {
    resetLines();
    const before = sourceFile('Conveyor.st', [
      enumTypeDecl('E_ConveyorState', [{ name: 'IDLE' }]),
    ]);
    resetLines();
    const after = sourceFile('Conveyor.st', [
      enumTypeDecl('E_ConveyorState', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const hmi = sourceFile('Conveyor_HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'E_ConveyorState',
          values: ['E_ConveyorState.IDLE'],
          hasElse: true,
        }),
      ]),
    ]);
    const findings = review([before, hmi], [after, hmi]);
    expect(findings.filter((f) => f.category === 'ENUM_VALUE_ADDED')).toHaveLength(0);
  });
});
