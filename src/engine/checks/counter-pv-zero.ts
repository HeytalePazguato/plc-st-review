import { parseStNumber } from '../literals.js';
import type { Check, CounterPvAssignment, Finding, GlobalVar } from '../types.js';

function isZero(text: string, globals: Map<string, GlobalVar>): boolean {
  const t = text.trim();
  const lit = parseStNumber(t);
  if (lit !== null) return lit === 0;
  const g = globals.get(t);
  if (g?.constant && g.initial !== undefined) {
    const v = parseStNumber(g.initial);
    if (v !== null) return v === 0;
  }
  return false;
}

function key(a: CounterPvAssignment): string {
  return `${a.file}::${a.counterName}::${a.line}`;
}

export const counterPvZero: Check = {
  category: 'COUNTER_PV_ZERO',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const a of ctx.before.counterPvAssignments) {
      if (isZero(a.pvValue, ctx.before.globals)) before.add(key(a));
    }
    for (const a of ctx.after.counterPvAssignments) {
      if (!isZero(a.pvValue, ctx.after.globals)) continue;
      if (before.has(key(a))) continue;
      findings.push({
        severity: 'error',
        category: 'COUNTER_PV_ZERO',
        file: a.file,
        line: a.line,
        summary: `Counter ${a.counterName}.PV resolves to zero (value: ${a.pvValue})`,
        detail:
          'A preset of 0 makes the counter trip immediately on the first count or never count at all, depending on type. Either set a positive PV or remove the counter.',
      });
    }
    return findings;
  },
};
