import { describe, expect, it } from 'vitest';
import {
  enumTypeDecl,
  memberAccess,
  programDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ENUM_MEMBER_UNKNOWN', () => {
  it('flags a typo in a qualified enum reference', () => {
    resetLines();
    const enums = sourceFile('E.st', [
      enumTypeDecl('E_State', [{ name: 'IDLE' }, { name: 'RUNNING' }]),
    ]);
    resetLines();
    const useBefore = sourceFile('U.st', [
      programDecl('U', [memberAccess('E_State', 'IDLE')]),
    ]);
    resetLines();
    const useAfter = sourceFile('U.st', [
      programDecl('U', [memberAccess('E_State', 'IDEL')]),
    ]);
    const findings = review([enums, useBefore], [enums, useAfter]);
    const u = findings.filter((f) => f.category === 'ENUM_MEMBER_UNKNOWN');
    expect(u).toHaveLength(1);
    expect(u[0].summary).toContain('IDEL');
    expect(u[0].detail).toContain('IDLE');
  });

  it('does not flag member access on non-enum types', () => {
    resetLines();
    const use = sourceFile('U.st', [
      programDecl('U', [memberAccess('T_Timer', 'Q')]),
    ]);
    const findings = review([use], [use]);
    expect(findings.filter((f) => f.category === 'ENUM_MEMBER_UNKNOWN')).toHaveLength(0);
  });
});
