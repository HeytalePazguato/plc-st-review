import type { Check, Finding, ForLoop } from '../types.js';

interface IterCount {
  count: number | null;
  start: number | null;
  end: number | null;
  by: number;
}

function iterCount(loop: ForLoop): IterCount {
  const s = Number.parseFloat(loop.start);
  const e = Number.parseFloat(loop.end);
  const b = loop.by !== undefined ? Number.parseFloat(loop.by) : 1;
  if (!Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(b) || b === 0) {
    return { count: null, start: null, end: null, by: 1 };
  }
  const span = (e - s) / b;
  return { count: Math.max(0, Math.floor(span) + 1), start: s, end: e, by: b };
}

export const loopBoundsChanged: Check = {
  category: 'LOOP_BOUNDS_CHANGED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = ctx.before.forLoops;
    const after = ctx.after.forLoops;
    // Pair loops by (file, scope, line) — best heuristic without flow analysis.
    const beforeIdx = new Map<string, ForLoop>();
    for (const l of before) beforeIdx.set(`${l.file}::${l.scope}::${l.line}`, l);
    for (const a of after) {
      const b = beforeIdx.get(`${a.file}::${a.scope}::${a.line}`);
      if (!b) continue;
      if (b.start === a.start && b.end === a.end && (b.by ?? '1') === (a.by ?? '1')) continue;
      const bCount = iterCount(b);
      const aCount = iterCount(a);
      let severity: Finding['severity'] = 'info';
      let summary = `FOR loop bounds: ${b.start}..${b.end}${b.by ? ' BY ' + b.by : ''} → ${a.start}..${a.end}${a.by ? ' BY ' + a.by : ''}`;
      let detail: string | undefined;
      if (bCount.count !== null && aCount.count !== null && bCount.count > 0) {
        const ratio = aCount.count / bCount.count;
        detail = `Iterations: ${bCount.count} → ${aCount.count} (${ratio.toFixed(1)}×)`;
        if (ratio >= 10 || ratio <= 0.1) severity = 'warn';
      }
      findings.push({
        severity,
        category: 'LOOP_BOUNDS_CHANGED',
        file: a.file,
        line: a.line,
        summary,
        detail,
      });
    }
    return findings;
  },
};
