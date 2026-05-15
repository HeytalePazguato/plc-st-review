import type { Check, Finding, ReturnPoint } from '../types.js';

function group(rs: readonly ReturnPoint[]): Map<string, ReturnPoint[]> {
  const m = new Map<string, ReturnPoint[]>();
  for (const r of rs) {
    const arr = m.get(r.scope) ?? [];
    arr.push(r);
    m.set(r.scope, arr);
  }
  return m;
}

export const multipleExitPoints: Check = {
  category: 'MULTIPLE_EXIT_POINTS',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeGrouped = group(ctx.before.returnPoints);
    const afterGrouped = group(ctx.after.returnPoints);
    for (const [scope, returns] of afterGrouped) {
      if (returns.length <= 1) continue;
      const beforeCount = beforeGrouped.get(scope)?.length ?? 0;
      if (beforeCount > 1) continue; // legacy multi-exit, not introduced now
      const last = returns[returns.length - 1];
      findings.push({
        severity: 'info',
        category: 'MULTIPLE_EXIT_POINTS',
        file: last.file,
        line: last.line,
        summary: `${scope} has ${returns.length} RETURN statements`,
        detail:
          'Multi-exit POUs are harder to reason about and to trace. Where practical, refactor so the POU has a single exit point.',
      });
    }
    return findings;
  },
};
