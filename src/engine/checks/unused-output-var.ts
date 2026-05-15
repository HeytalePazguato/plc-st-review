import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

function isWritten(d: NamedDecl, t: SymbolTable): boolean {
  for (const tgt of t.assignmentTargets) {
    if (tgt.scope !== d.scope) continue;
    if (tgt.name.toLowerCase() === d.name.toLowerCase()) return true;
  }
  return false;
}

function key(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.name.toLowerCase()}`;
}

export const unusedOutputVar: Check = {
  category: 'UNUSED_OUTPUT_VAR',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const d of ctx.before.declarations) {
      if (d.kind !== 'var_output') continue;
      if (!isWritten(d, ctx.before)) before.add(key(d));
    }
    for (const d of ctx.after.declarations) {
      if (d.kind !== 'var_output') continue;
      if (isWritten(d, ctx.after)) continue;
      if (before.has(key(d))) continue;
      findings.push({
        severity: 'info',
        category: 'UNUSED_OUTPUT_VAR',
        file: d.file,
        line: d.line,
        summary: `VAR_OUTPUT ${d.name} in ${d.scope} is declared but never written`,
        detail:
          'Callers reading this output will only ever see its initial value. Either remove the output or wire it to actual logic.',
      });
    }
    return findings;
  },
};
