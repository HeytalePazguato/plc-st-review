import { normalizeTimeLiteral } from '../diff.js';
import type { Check, Finding, TimerPtAssignment } from '../types.js';

export const timerValueChanged: Check = {
  category: 'TIMER_VALUE_CHANGED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeByKey = indexByKey(ctx.before.timerPtAssignments);
    const afterByKey = indexByKey(ctx.after.timerPtAssignments);
    for (const [key, after] of afterByKey) {
      const before = beforeByKey.get(key);
      if (!before) continue;
      if (before.ptValue === after.ptValue) continue;
      const ratio = ratioOf(before.ptValue, after.ptValue);
      const severity =
        ratio !== null && Math.abs(Math.log10(ratio)) >= 1
          ? 'error'
          : ratio !== null && Math.abs(Math.log10(ratio)) >= Math.log10(2)
            ? 'warn'
            : 'info';
      findings.push({
        severity,
        category: 'TIMER_VALUE_CHANGED',
        file: after.file,
        line: after.line,
        summary: `Timer ${after.timerName}.PT: ${before.ptValue} → ${after.ptValue}${ratioTag(ratio)}`,
        detail:
          ratio !== null
            ? `Ratio after/before ≈ ${ratio.toFixed(3)}. Confirm the change was intentional.`
            : 'Non-time-literal PT value; could not compute a ratio.',
      });
    }
    return findings;
  },
};

function indexByKey(
  list: readonly TimerPtAssignment[],
): Map<string, TimerPtAssignment> {
  const m = new Map<string, TimerPtAssignment>();
  for (const a of list) m.set(`${a.file}::${a.timerName}`, a);
  return m;
}

function ratioOf(before: string, after: string): number | null {
  const b = normalizeTimeLiteral(before);
  const a = normalizeTimeLiteral(after);
  if (b === null || a === null || b === 0) return null;
  return a / b;
}

function ratioTag(ratio: number | null): string {
  if (ratio === null) return '';
  if (ratio >= 1) return ` (${ratio.toFixed(1)}x slower)`;
  return ` (${(1 / ratio).toFixed(1)}x faster)`;
}
