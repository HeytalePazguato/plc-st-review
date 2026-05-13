import type { CallSite, Check, Finding, SymbolTable } from '../types.js';

function isAdrOfConstant(cs: CallSite, t: SymbolTable): { name: string } | null {
  if (cs.callee.toLowerCase() !== 'adr') return null;
  const arg = cs.positionalArgs[0]?.trim();
  if (!arg) return null;
  const g = t.globals.get(arg);
  if (g?.constant) return { name: arg };
  return null;
}

function key(cs: CallSite): string {
  return `${cs.file}::${cs.line}`;
}

export const addressOfConstant: Check = {
  category: 'ADDRESS_OF_CONSTANT',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const cs of ctx.before.callSites) {
      if (isAdrOfConstant(cs, ctx.before)) before.add(key(cs));
    }
    for (const cs of ctx.after.callSites) {
      const hit = isAdrOfConstant(cs, ctx.after);
      if (!hit) continue;
      if (before.has(key(cs))) continue;
      findings.push({
        severity: 'warn',
        category: 'ADDRESS_OF_CONSTANT',
        file: cs.file,
        line: cs.line,
        summary: `ADR(${hit.name}) — taking the address of a CONSTANT`,
        detail:
          'A CONSTANT may live in flash/read-only storage on some runtimes; dereferencing a pointer derived from it can fault. If you need a mutable copy, declare a regular VAR_GLOBAL initialised to the constant.',
      });
    }
    return findings;
  },
};
