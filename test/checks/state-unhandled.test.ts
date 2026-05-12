import { describe, expect, it } from 'vitest';
import {
  caseStatement,
  enumTypeDecl,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('STATE_UNHANDLED', () => {
  it('flags a CASE that misses enum values regardless of changes', () => {
    resetLines();
    const enums = sourceFile('Enums.st', [
      enumTypeDecl('E_State', [
        { name: 'IDLE' },
        { name: 'RUNNING' },
        { name: 'FAULT' },
      ]),
    ]);
    resetLines();
    const hmi = sourceFile('HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'E_State',
          values: ['E_State.IDLE', 'E_State.RUNNING'],
        }),
      ]),
    ]);
    const findings = review([enums, hmi], [enums, hmi]);
    const su = findings.filter((f) => f.category === 'STATE_UNHANDLED');
    expect(su).toHaveLength(1);
    expect(su[0].detail).toContain('FAULT');
  });

  it('does not flag a CASE that covers all values', () => {
    resetLines();
    const enums = sourceFile('Enums.st', [
      enumTypeDecl('E_State', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const hmi = sourceFile('HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'E_State',
          values: ['E_State.IDLE', 'E_State.RUNNING'],
        }),
      ]),
    ]);
    const findings = review([enums, hmi], [enums, hmi]);
    expect(findings.filter((f) => f.category === 'STATE_UNHANDLED')).toHaveLength(0);
  });

  it('does not flag a CASE with an ELSE clause', () => {
    resetLines();
    const enums = sourceFile('Enums.st', [
      enumTypeDecl('E_State', [
        { name: 'IDLE' },
        { name: 'RUNNING' },
        { name: 'FAULT' },
      ]),
    ]);
    resetLines();
    const hmi = sourceFile('HMI.st', [
      programDecl('HMI', [
        caseStatement({
          switchExpr: 'E_State',
          values: ['E_State.IDLE'],
          hasElse: true,
        }),
      ]),
    ]);
    const findings = review([enums, hmi], [enums, hmi]);
    expect(findings.filter((f) => f.category === 'STATE_UNHANDLED')).toHaveLength(0);
  });
});
