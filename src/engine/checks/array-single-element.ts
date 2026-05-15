import type { ArrayDecl, Check, Finding } from '../types.js';

function key(a: ArrayDecl): string {
  return `${a.file}::${a.scope}::${a.varName}`;
}

function isSingleElement(a: ArrayDecl): boolean {
  const lo = Number.parseFloat(a.lower);
  const hi = Number.parseFloat(a.upper);
  return Number.isFinite(lo) && Number.isFinite(hi) && lo === hi;
}

export const arraySingleElement: Check = {
  category: 'ARRAY_SINGLE_ELEMENT',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const a of ctx.before.arrayDecls) {
      if (isSingleElement(a)) before.add(key(a));
    }
    for (const a of ctx.after.arrayDecls) {
      if (!isSingleElement(a)) continue;
      if (before.has(key(a))) continue;
      findings.push({
        severity: 'info',
        category: 'ARRAY_SINGLE_ELEMENT',
        file: a.file,
        line: a.line,
        summary: `Array ${a.varName} declared with a single element [${a.lower}..${a.upper}]`,
        detail:
          'An array of length one is usually a mistake, either the bounds are wrong, or a scalar variable would be clearer.',
      });
    }
    return findings;
  },
};
