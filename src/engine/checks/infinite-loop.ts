import type { Check, Finding, WhileLoop } from '../types.js';

function isInfinite(w: WhileLoop): boolean {
  if (w.hasExit) return false;
  const cond = w.conditionText.toUpperCase().replace(/\s+/g, '');
  return cond === 'TRUE' || cond === '1';
}

function key(w: WhileLoop): string {
  return `${w.file}::${w.scope}::${w.line}`;
}

export const infiniteLoop: Check = {
  category: 'INFINITE_LOOP',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const w of ctx.before.whileLoops) {
      if (isInfinite(w)) beforeBad.add(key(w));
    }
    for (const w of ctx.after.whileLoops) {
      if (!isInfinite(w)) continue;
      if (beforeBad.has(key(w))) continue;
      findings.push({
        severity: 'error',
        category: 'INFINITE_LOOP',
        file: w.file,
        line: w.line,
        summary: 'WHILE TRUE loop with no EXIT statement',
        detail:
          'On a PLC scan, an infinite loop blocks the rest of the program forever. Either add EXIT inside the body or convert to a state-driven structure.',
      });
    }
    return findings;
  },
};
