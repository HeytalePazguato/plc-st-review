import type { ArrayDecl, Check, Finding } from '../types.js';

function key(a: ArrayDecl): string {
  return `${a.scope}::${a.varName}`;
}

export const arrayBoundsChanged: Check = {
  category: 'ARRAY_BOUNDS_CHANGED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeIdx = new Map<string, ArrayDecl>();
    for (const a of ctx.before.arrayDecls) beforeIdx.set(key(a), a);
    for (const after of ctx.after.arrayDecls) {
      const before = beforeIdx.get(key(after));
      if (!before) continue;
      if (before.lower === after.lower && before.upper === after.upper) continue;
      const beforeSpan = Number(before.upper) - Number(before.lower);
      const afterSpan = Number(after.upper) - Number(after.lower);
      const shrunk = Number.isFinite(beforeSpan) && Number.isFinite(afterSpan) && afterSpan < beforeSpan;
      findings.push({
        severity: shrunk ? 'error' : 'warn',
        category: 'ARRAY_BOUNDS_CHANGED',
        file: after.file,
        line: after.line,
        summary: `Array ${after.varName} bounds: [${before.lower}..${before.upper}] → [${after.lower}..${after.upper}]`,
        detail: shrunk
          ? 'Array shrank, any indexed access that hit the old upper bound is now out of range.'
          : 'Array grew, indexing should still work but downstream allocations may need review.',
      });
    }
    return findings;
  },
};
