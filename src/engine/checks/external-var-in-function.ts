import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

// PLCopen CP6 — VAR_EXTERNAL shall not appear inside FUNCTION / FUNCTION_BLOCK
// / METHOD bodies. Functions in IEC 61131-3 are supposed to be pure value
// transformations; reaching out to a VAR_GLOBAL via VAR_EXTERNAL makes them
// stateful and harder to reason about. PLCopen forbids it.

function enclosingPouKind(d: NamedDecl, t: SymbolTable): string | null {
  const p = t.pous.get(d.scope);
  return p?.kind ?? null;
}

function key(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.name.toLowerCase()}`;
}

export const externalVarInFunction: Check = {
  category: 'EXTERNAL_VAR_IN_FUNCTION',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const d of ctx.before.declarations) {
      if (d.kind !== 'var_external') continue;
      const kind = enclosingPouKind(d, ctx.before);
      if (kind === 'function' || kind === 'function_block' || kind === 'method') {
        before.add(key(d));
      }
    }
    for (const d of ctx.after.declarations) {
      if (d.kind !== 'var_external') continue;
      const kind = enclosingPouKind(d, ctx.after);
      if (kind !== 'function' && kind !== 'function_block' && kind !== 'method') continue;
      if (before.has(key(d))) continue;
      findings.push({
        severity: 'warn',
        category: 'EXTERNAL_VAR_IN_FUNCTION',
        file: d.file,
        line: d.line,
        summary: `VAR_EXTERNAL ${d.name} declared inside ${kind} ${d.scope} (PLCopen CP6)`,
        detail:
          'PLCopen CP6: avoid VAR_EXTERNAL inside FUNCTION, FUNCTION_BLOCK, and METHOD bodies. Reaching directly into a global from a function-like body makes the POU stateful, harder to test in isolation, and brittle when the global is renamed or retyped. Pass the value in via VAR_INPUT / VAR_IN_OUT instead.',
      });
    }
    return findings;
  },
};
