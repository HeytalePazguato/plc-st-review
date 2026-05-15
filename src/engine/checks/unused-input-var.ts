import type { Check, Finding, NamedDecl, Pou, SymbolTable } from '../types.js';

function isReferencedInScope(name: string, scope: string, t: SymbolTable): boolean {
  // Count references in the scope, ignoring the declaration line itself.
  for (const ref of t.varReferences) {
    if (ref.scope !== scope) continue;
    if (ref.name.toLowerCase() === name.toLowerCase()) return true;
  }
  return false;
}

function key(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.name.toLowerCase()}`;
}

function isPou(scope: string, t: SymbolTable): Pou | undefined {
  return t.pous.get(scope);
}

export const unusedInputVar: Check = {
  category: 'UNUSED_INPUT_VAR',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const d of ctx.before.declarations) {
      if (d.kind !== 'var_input') continue;
      const refs = countRefsExcludingDecl(d.name, d.scope, d.line, ctx.before);
      if (refs === 0 && isPou(d.scope, ctx.before)) before.add(key(d));
    }
    for (const d of ctx.after.declarations) {
      if (d.kind !== 'var_input') continue;
      const refs = countRefsExcludingDecl(d.name, d.scope, d.line, ctx.after);
      if (refs > 0) continue;
      if (!isPou(d.scope, ctx.after)) continue;
      if (before.has(key(d))) continue;
      void isReferencedInScope; // (kept for symmetry; not used directly below)
      findings.push({
        severity: 'info',
        category: 'UNUSED_INPUT_VAR',
        file: d.file,
        line: d.line,
        summary: `VAR_INPUT ${d.name} in ${d.scope} is never read in the POU body`,
        detail:
          'Either remove the input or replace its usages with the actual logic that should have consumed it.',
      });
    }
    return findings;
  },
};

function countRefsExcludingDecl(
  name: string,
  scope: string,
  declLine: number,
  t: SymbolTable,
): number {
  let n = 0;
  for (const ref of t.varReferences) {
    if (ref.scope !== scope) continue;
    if (ref.line === declLine) continue;
    if (ref.name.toLowerCase() === name.toLowerCase()) n += 1;
  }
  return n;
}
