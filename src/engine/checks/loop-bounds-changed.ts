import type { Check, Finding, ForLoop, GlobalVar } from '../types.js';

interface IterCount {
  count: number | null;
}

/**
 * Resolve a loop-bound expression to a number, looking up the value in the
 * supplied globals table when the expression is an identifier referring to
 * a CONSTANT global. Returns null when resolution fails (e.g. local var,
 * complex expression, unknown identifier).
 */
function resolveBound(text: string, globals: Map<string, GlobalVar>): number | null {
  const lit = Number.parseFloat(text);
  if (Number.isFinite(lit) && /^-?[\d.]+$/.test(text.trim())) return lit;
  const g = globals.get(text.trim());
  if (g?.constant && g.initial !== undefined) {
    const v = Number.parseFloat(g.initial);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

function iterCount(loop: ForLoop, globals: Map<string, GlobalVar>): IterCount {
  const s = resolveBound(loop.start, globals);
  const e = resolveBound(loop.end, globals);
  const b = loop.by !== undefined ? resolveBound(loop.by, globals) ?? 1 : 1;
  if (s === null || e === null || b === 0) return { count: null };
  const span = (e - s) / b;
  return { count: Math.max(0, Math.floor(span) + 1) };
}

export const loopBoundsChanged: Check = {
  category: 'LOOP_BOUNDS_CHANGED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    // Pair loops by (file, scope, loopVar). Line-based pairing breaks when
    // unrelated edits above the loop shift line numbers; the loop variable
    // is usually a stable identifier within a POU.
    const beforeIdx = new Map<string, ForLoop>();
    for (const l of ctx.before.forLoops) {
      beforeIdx.set(`${l.file}::${l.scope}::${l.loopVar.toLowerCase()}`, l);
    }
    for (const a of ctx.after.forLoops) {
      const b = beforeIdx.get(`${a.file}::${a.scope}::${a.loopVar.toLowerCase()}`);
      if (!b) continue;
      if (b.start === a.start && b.end === a.end && (b.by ?? '1') === (a.by ?? '1')) continue;
      const bCount = iterCount(b, ctx.before.globals);
      const aCount = iterCount(a, ctx.after.globals);
      let severity: Finding['severity'] = 'info';
      const summary = `FOR loop bounds: ${b.start}..${b.end}${b.by ? ' BY ' + b.by : ''} → ${a.start}..${a.end}${a.by ? ' BY ' + a.by : ''}`;
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
