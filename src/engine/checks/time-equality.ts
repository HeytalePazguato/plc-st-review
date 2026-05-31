import type { BinaryExpression, Check, Finding, SymbolTable } from '../types.js';

// PLCopen CP28 — equality / inequality on TIME values is unreliable for the
// same reason REAL equality is: tick-resolution granularity means the same
// "5 second" duration sampled at two slightly different cycles can compare
// unequal. Use a range comparison instead.

const EQ_OPS = new Set<string>(['=', '<>']);
const TIME_TYPES = new Set<string>(['TIME', 'LTIME', 'TIME_OF_DAY', 'TOD', 'DATE', 'DATE_AND_TIME', 'DT']);

function isTimeLiteral(text: string): boolean {
  // T#5s, T#500ms, TIME#PT1S, LTIME#... — all start with T# / TIME# / LTIME#.
  return /^(L?TIME|T)#/i.test(text.trim());
}

function timeNamedVars(t: SymbolTable): Set<string> {
  const out = new Set<string>();
  for (const d of t.declarations) {
    if (TIME_TYPES.has((d.typeText ?? '').toUpperCase())) out.add(d.name.toLowerCase());
  }
  return out;
}

function firstSegment(text: string): string {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(text.trim());
  return (m?.[1] ?? '').toLowerCase();
}

function involvesTime(b: BinaryExpression, timeVars: Set<string>): boolean {
  if (isTimeLiteral(b.leftText) || isTimeLiteral(b.rightText)) return true;
  return timeVars.has(firstSegment(b.leftText)) || timeVars.has(firstSegment(b.rightText));
}

function key(b: BinaryExpression): string {
  return `${b.file}::${b.line}::${b.op}::${b.leftText}::${b.rightText}`;
}

export const timeEquality: Check = {
  category: 'TIME_EQUALITY',
  defaultSeverity: 'warn',
  run(ctx) {
    const beforeTime = timeNamedVars(ctx.before);
    const afterTime = timeNamedVars(ctx.after);
    const findings: Finding[] = [];
    const before = new Set(
      ctx.before.binaryExpressions
        .filter((b) => EQ_OPS.has(b.op) && involvesTime(b, beforeTime))
        .map(key),
    );
    for (const b of ctx.after.binaryExpressions) {
      if (!EQ_OPS.has(b.op)) continue;
      if (!involvesTime(b, afterTime)) continue;
      if (before.has(key(b))) continue;
      findings.push({
        severity: 'warn',
        category: 'TIME_EQUALITY',
        file: b.file,
        line: b.line,
        summary: `TIME equality compare '${b.leftText} ${b.op} ${b.rightText}' (PLCopen CP28)`,
        detail:
          'PLCopen CP28: `=` / `<>` on TIME values is unreliable. Two "equal" durations sampled at slightly different cycles can compare unequal because of tick-resolution. Use a range comparison (`>=` / `<=` against an explicit tolerance) instead.',
      });
    }
    return findings;
  },
};
