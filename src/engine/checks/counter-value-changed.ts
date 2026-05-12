import type { Check, CounterPvAssignment, Finding } from '../types.js';

function indexByKey(
  list: readonly CounterPvAssignment[],
): Map<string, CounterPvAssignment> {
  const m = new Map<string, CounterPvAssignment>();
  for (const a of list) m.set(`${a.file}::${a.counterName}`, a);
  return m;
}

function ratioOf(before: string, after: string): number | null {
  const b = Number.parseFloat(before);
  const a = Number.parseFloat(after);
  if (!Number.isFinite(b) || !Number.isFinite(a) || b === 0) return null;
  return a / b;
}

export const counterValueChanged: Check = {
  category: 'COUNTER_VALUE_CHANGED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = indexByKey(ctx.before.counterPvAssignments);
    for (const [key, after] of indexByKey(ctx.after.counterPvAssignments)) {
      const b = before.get(key);
      if (!b) continue;
      if (b.pvValue === after.pvValue) continue;
      const ratio = ratioOf(b.pvValue, after.pvValue);
      const severity: Finding['severity'] =
        ratio !== null && (ratio >= 10 || ratio <= 0.1)
          ? 'error'
          : ratio !== null && (ratio >= 2 || ratio <= 0.5)
            ? 'warn'
            : 'info';
      findings.push({
        severity,
        category: 'COUNTER_VALUE_CHANGED',
        file: after.file,
        line: after.line,
        summary: `Counter ${after.counterName}.PV: ${b.pvValue} → ${after.pvValue}${ratio !== null ? ` (${ratio.toFixed(2)}×)` : ''}`,
        detail:
          ratio !== null
            ? `Magnitude ratio ${ratio.toFixed(3)}. Counter trips earlier/later as a result.`
            : 'Non-numeric PV value; could not compute a ratio.',
      });
    }
    return findings;
  },
};
