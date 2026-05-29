import type { Check, Finding, ForLoop, GlobalVar } from '../types.js';

function resolve(text: string, globals: Map<string, GlobalVar>): number | null {
  let t = text.trim();
  // Unwrap parenthesized steps like `(-2)` or `((2))`.
  while (t.length >= 2 && t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1).trim();
  // Signed numeric literal.
  if (/^[-+]?[\d.]+$/.test(t)) {
    const lit = Number.parseFloat(t);
    return Number.isFinite(lit) ? lit : null;
  }
  // Unary sign over a resolvable operand, e.g. `-STEP` where STEP is a constant.
  if (t.startsWith('-') || t.startsWith('+')) {
    const inner = resolve(t.slice(1), globals);
    return inner === null ? null : (t.startsWith('-') ? -inner : inner);
  }
  // Identifier referring to a CONSTANT global.
  const g = globals.get(t);
  if (g?.constant && g.initial !== undefined) {
    const v = Number.parseFloat(g.initial.trim());
    if (Number.isFinite(v) && /^[-+]?[\d.]+$/.test(g.initial.trim())) return v;
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
  if (s === null || e === null) return null;
  // No BY clause means the IEC default step of +1. A BY clause that we cannot
  // resolve to a constant (e.g. a runtime expression) leaves the direction
  // unknown, so skip rather than assume +1 and risk a false positive on a
  // valid descending loop.
  let b: number;
  if (loop.by === undefined) {
    b = 1;
  } else {
    const rb = resolve(loop.by, globals);
    if (rb === null) return null;
    b = rb;
  }
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
