import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

function outputDecls(t: SymbolTable): NamedDecl[] {
  return t.declarations.filter((d) => d.kind === 'var_output');
}

function isReadInsideScope(d: NamedDecl, t: SymbolTable): boolean {
  for (const ref of t.varReferences) {
    if (ref.scope !== d.scope) continue;
    if (ref.line === d.line) continue;
    if (ref.name.toLowerCase() !== d.name.toLowerCase()) continue;
    // ref.context distinguishes the LHS (write) from any RHS use (read).
    // This correctly handles `rOut := rOut + 1.0;` — the same name appears
    // as both a write and a read on one line; the old same-line heuristic
    // masked the read because an assignment target existed on that line.
    if (ref.context === 'read') return true;
  }
  return false;
}

function key(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.name.toLowerCase()}`;
}

export const outputVarReadInternally: Check = {
  category: 'OUTPUT_VAR_READ_INTERNALLY',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const d of outputDecls(ctx.before)) {
      if (isReadInsideScope(d, ctx.before)) before.add(key(d));
    }
    for (const d of outputDecls(ctx.after)) {
      if (!isReadInsideScope(d, ctx.after)) continue;
      if (before.has(key(d))) continue;
      findings.push({
        severity: 'info',
        category: 'OUTPUT_VAR_READ_INTERNALLY',
        file: d.file,
        line: d.line,
        summary: `VAR_OUTPUT ${d.name} is read inside ${d.scope}`,
        detail:
          'An output is meant to publish a result, not to store working state. Reading it back inside the same POU usually means you wanted a local intermediate. Add a VAR for the working value and assign the output once at the end.',
      });
    }
    return findings;
  },
};
