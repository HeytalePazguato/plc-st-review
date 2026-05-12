import type { Check, Finding, GlobalVar, TimerPtAssignment } from '../types.js';

function parseTime(text: string): number | null {
  // Reuse the time-literal parser via a quick inline copy (avoids a circular import).
  const trimmed = text.trim().replace(/^TIME#/i, '').replace(/^T#/i, '');
  if (trimmed === '0' || trimmed === '0.0') return 0;
  const re =
    /^(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m(?!s))?(?:(\d+)s)?(?:(\d+)ms)?(?:(\d+)us)?(?:(\d+)ns)?$/i;
  const m = re.exec(trimmed);
  if (!m) return null;
  const [, d, h, mins, s, ms, us, ns] = m;
  if (!d && !h && !mins && !s && !ms && !us && !ns) return null;
  let total = 0;
  total += parseInt(d ?? '0', 10) * 86_400_000;
  total += parseInt(h ?? '0', 10) * 3_600_000;
  total += parseInt(mins ?? '0', 10) * 60_000;
  total += parseInt(s ?? '0', 10) * 1_000;
  total += parseInt(ms ?? '0', 10);
  return total;
}

function isZero(text: string, globals: Map<string, GlobalVar>): boolean {
  const v = parseTime(text);
  if (v !== null) return v === 0;
  const g = globals.get(text.trim());
  if (g?.constant && g.initial !== undefined) {
    const gv = parseTime(g.initial);
    if (gv !== null) return gv === 0;
  }
  return false;
}

function key(a: TimerPtAssignment): string {
  return `${a.file}::${a.timerName}::${a.line}`;
}

export const timerPtZero: Check = {
  category: 'TIMER_PT_ZERO',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const a of ctx.before.timerPtAssignments) {
      if (isZero(a.ptValue, ctx.before.globals)) before.add(key(a));
    }
    for (const a of ctx.after.timerPtAssignments) {
      if (!isZero(a.ptValue, ctx.after.globals)) continue;
      if (before.has(key(a))) continue;
      findings.push({
        severity: 'error',
        category: 'TIMER_PT_ZERO',
        file: a.file,
        line: a.line,
        summary: `Timer ${a.timerName}.PT resolves to T#0s (value: ${a.ptValue})`,
        detail:
          'A PT of zero either fires immediately (TON/TP) or never (TOF on falling edge), neither of which is usually intended.',
      });
    }
    return findings;
  },
};
