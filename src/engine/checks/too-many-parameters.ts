import type { Check, Finding, Pou } from '../types.js';

function countParams(p: Pou): number {
  return p.inputs.length + p.outputs.length + p.inOuts.length;
}

function key(p: Pou): string {
  return `${p.file}::${p.qualifiedName}`;
}

export const tooManyParameters: Check = {
  category: 'TOO_MANY_PARAMETERS',
  defaultSeverity: 'warn',
  run(ctx) {
    const cap = ctx.config.limits.maxParameters;
    if (cap === null) return [];
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const p of ctx.before.pous.values()) {
      if (countParams(p) > cap) beforeBad.add(key(p));
    }
    for (const p of ctx.after.pous.values()) {
      const n = countParams(p);
      if (n <= cap) continue;
      if (beforeBad.has(key(p))) continue;
      findings.push({
        severity: 'warn',
        category: 'TOO_MANY_PARAMETERS',
        file: p.file,
        line: p.line,
        summary: `${p.kind} ${p.qualifiedName} has ${n} parameters (cap ${cap}) — PLCopen CP23`,
        detail:
          'PLCopen CP23: keep the input/output/in-out surface of a POU bounded. Long parameter lists are a smell — group related fields into a STRUCT or refactor the POU.',
      });
    }
    return findings;
  },
};
