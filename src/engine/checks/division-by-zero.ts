import { parseStNumber } from '../literals.js';
import type { Check, DivisionExpr, Finding, GlobalVar } from '../types.js';

function divisorIsZero(d: DivisionExpr, globals: Map<string, GlobalVar>): boolean {
  const t = d.divisorText.trim();
  const lit = parseStNumber(t);
  if (lit !== null) return lit === 0;
  const g = globals.get(t);
  if (g?.constant && g.initial !== undefined) {
    const v = parseStNumber(g.initial);
    if (v !== null) return v === 0;
  }
  return false;
}

function key(d: DivisionExpr): string {
  return `${d.file}::${d.line}::${d.divisorText}`;
}

export const divisionByZero: Check = {
  category: 'DIVISION_BY_ZERO',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const d of ctx.before.divisions) {
      if (divisorIsZero(d, ctx.before.globals)) beforeBad.add(key(d));
    }
    for (const d of ctx.after.divisions) {
      if (!divisorIsZero(d, ctx.after.globals)) continue;
      if (beforeBad.has(key(d))) continue;
      findings.push({
        severity: 'error',
        category: 'DIVISION_BY_ZERO',
        file: d.file,
        line: d.line,
        summary: `Division by zero (divisor: ${d.divisorText})`,
        detail:
          'Constant divisor resolves to 0. Dynamic divisors (variables computed at runtime) are not checked.',
      });
    }
    return findings;
  },
};
