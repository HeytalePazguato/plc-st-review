import { describe, expect, it } from 'vitest';
import {
  caseStatement,
  enumTypeDecl,
  fbDecl,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ENUM_VALUE_UNUSED', () => {
  it('flags an enum value that was referenced before but no longer is', () => {
    resetLines();
    const beforeEnums = sourceFile('E.st', [
      enumTypeDecl('E_State', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const beforeUse = sourceFile('U.st', [
      programDecl('U', [
        caseStatement({
          switchExpr: 'E_State',
          values: ['E_State.IDLE', 'E_State.RUNNING'],
        }),
      ]),
    ]);
    resetLines();
    const afterEnums = sourceFile('E.st', [
      enumTypeDecl('E_State', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const afterUse = sourceFile('U.st', [
      programDecl('U', [
        caseStatement({
          switchExpr: 'E_State',
          values: ['E_State.IDLE'],
        }),
      ]),
    ]);
    const findings = review([beforeEnums, beforeUse], [afterEnums, afterUse]);
    const u = findings.filter((f) => f.category === 'ENUM_VALUE_UNUSED');
    expect(u).toHaveLength(1);
    expect(u[0].summary).toContain('RUNNING');
  });

  it('does not flag values that were already dead before the PR', () => {
    resetLines();
    const enums = sourceFile('E.st', [
      enumTypeDecl('E_State', [{ name: 'IDLE' }, { name: 'OLD_DEAD' }]),
    ]);
    resetLines();
    const use = sourceFile('U.st', [
      programDecl('U', [
        caseStatement({ switchExpr: 'E_State', values: ['E_State.IDLE'] }),
      ]),
    ]);
    const findings = review([enums, use], [enums, use]);
    expect(findings.filter((f) => f.category === 'ENUM_VALUE_UNUSED')).toHaveLength(0);
  });
});

// Suppress unused-imports lint
void fbDecl;
