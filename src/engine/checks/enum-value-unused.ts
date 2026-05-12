import type { Check, Finding, SymbolTable } from '../types.js';

function isReferenced(name: string, member: string, t: SymbolTable): boolean {
  // Member access of the form EnumName.MEMBER.
  for (const ma of t.memberAccesses) {
    if (
      ma.leftText.trim().toLowerCase() === name.toLowerCase() &&
      ma.rightText.trim().toLowerCase() === member.toLowerCase()
    ) {
      return true;
    }
  }
  // CASE values such as `E_State.MEMBER` or `MEMBER` when the switch
  // expression carries the type implicitly.
  const dotted = `${name}.${member}`.toLowerCase();
  for (const cs of t.caseStatements) {
    for (const v of cs.values) {
      const vl = v.trim().toLowerCase();
      if (vl === dotted || vl === member.toLowerCase()) return true;
    }
  }
  return false;
}

export const enumValueUnused: Check = {
  category: 'ENUM_VALUE_UNUSED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [name, def] of ctx.after.enums) {
      const beforeDef = ctx.before.enums.get(name);
      for (const value of def.values) {
        if (isReferenced(name, value.name, ctx.after)) continue;
        // Skip values that were already dead before — surface only regressions.
        const wasReferenced =
          beforeDef && beforeDef.values.some((v) => v.name === value.name)
            ? isReferenced(name, value.name, ctx.before)
            : false;
        if (!wasReferenced) continue;
        findings.push({
          severity: 'info',
          category: 'ENUM_VALUE_UNUSED',
          file: def.file,
          line: value.line,
          summary: `Enum value ${name}.${value.name} is no longer referenced anywhere`,
          detail:
            'Either remove the value from the enum if it is genuinely obsolete, or add a CASE branch / comparison that handles it.',
        });
      }
    }
    return findings;
  },
};
