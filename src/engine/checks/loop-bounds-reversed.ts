import type { Check, Finding, ForLoop, GlobalVar } from '../types.js';

function resolve(text: string, globals: Map<string, GlobalVar>): number | null {
  const lit = Number.parseFloat(text);
  if (Number.isFinite(lit) && /^-?[\d.]+$/.test(text.trim())) return lit;
  const g = globals.get(text.trim());
  if (g?.constant && g.initial !== undefined) {
    const v = Number.parseFloat(g.initial);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

interface Reversal {
  loop: ForLoop;
  reason: string;
}

function detect(
  loop: ForLoop,
  globals: Map<string, GlobalVar>,
): Reversal | null {
  const s = resolve(loop.start, globals);
  const e = resolve(loop.end, globals);
  const b = loop.by !== undefined ? resolve(loop.by, globals) ?? 1 : 1;
  if (s === null || e === null) return null;
  if (b > 0 && s > e) {
    return {
      loop,
      reason: `start (${s}) > end (${e}) with positive step (${b})`,
    };
  }
  if (b < 0 && s < e) {
    return {
      loop,
      reason: `start (${s}) < end (${e}) with negative step (${b})`,
    };
  }
  return null;
}

function key(loop: ForLoop): string {
  return `${loop.file}::${loop.scope}::${loop.loopVar.toLowerCase()}`;
}

export const loopBoundsReversed: Check = {
  category: 'LOOP_BOUNDS_REVERSED',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const loop of ctx.before.forLoops) {
      if (detect(loop, ctx.before.globals)) beforeBad.add(key(loop));
    }
    for (const loop of ctx.after.forLoops) {
      const rev = detect(loop, ctx.after.globals);
      if (!rev) continue;
      if (beforeBad.has(key(loop))) continue;
      findings.push({
        severity: 'error',
        category: 'LOOP_BOUNDS_REVERSED',
        file: loop.file,
        line: loop.line,
        summary: `FOR loop bounds and step disagree: ${rev.reason}`,
        detail:
          'Per IEC 61131-3 the body never executes; on PLC runtimes that wrap integer overflow the loop runs many more times than intended. Either swap start/end or invert the BY direction.',
      });
    }
    return findings;
  },
};
