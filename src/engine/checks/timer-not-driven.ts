import type { Check, Finding, SymbolTable, TimerInstance } from '../types.js';

interface TimerUsage {
  hasCallWithIn: boolean;
  hasAnyCall: boolean;
  qRead: boolean;
}

function usage(t: TimerInstance, symbols: SymbolTable): TimerUsage {
  let hasCallWithIn = false;
  let hasAnyCall = false;
  for (const cs of symbols.callSites) {
    if (cs.callee.toLowerCase() !== t.name.toLowerCase()) continue;
    if (cs.file !== t.file) continue;
    hasAnyCall = true;
    if (cs.namedArgs.has('IN')) hasCallWithIn = true;
  }
  let qRead = false;
  for (const ref of symbols.memberAccesses) {
    if (
      ref.file === t.file &&
      ref.leftText.toLowerCase() === t.name.toLowerCase() &&
      (ref.rightText.toUpperCase() === 'Q' || ref.rightText.toUpperCase() === 'ET')
    ) {
      qRead = true;
      break;
    }
  }
  return { hasCallWithIn, hasAnyCall, qRead };
}

function key(t: TimerInstance): string {
  return `${t.file}::${t.scope}::${t.name}`;
}

export const timerNotDriven: Check = {
  category: 'TIMER_NOT_DRIVEN',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const t of ctx.before.timerInstances) {
      const u = usage(t, ctx.before);
      if (u.qRead && !u.hasCallWithIn) beforeBad.add(key(t));
    }
    for (const t of ctx.after.timerInstances) {
      const u = usage(t, ctx.after);
      if (!(u.qRead && !u.hasCallWithIn)) continue;
      if (beforeBad.has(key(t))) continue;
      findings.push({
        severity: 'warn',
        category: 'TIMER_NOT_DRIVEN',
        file: t.file,
        line: t.line,
        summary: `Timer ${t.name} (${t.timerType}) has its Q/ET read but no call sets IN`,
        detail: u.hasAnyCall
          ? 'The timer is invoked but never with a named `IN := ...` argument. Q will stay at its initial value.'
          : 'The timer is never invoked at all. Add a call with `IN := ...` to drive it.',
      });
    }
    return findings;
  },
};
