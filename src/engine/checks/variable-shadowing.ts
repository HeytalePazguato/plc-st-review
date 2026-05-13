import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

function localKey(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.name.toLowerCase()}`;
}

function shadowsGlobal(d: NamedDecl, t: SymbolTable): boolean {
  if (d.scope === '__global') return false;
  return t.globals.has(d.name) || t.globals.has(d.name.toLowerCase());
}

export const variableShadowing: Check = {
  category: 'VARIABLE_SHADOWING',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const localKinds = new Set<NamedDecl['kind']>(['var_local', 'var_input', 'var_output', 'var_in_out', 'var_temp']);
    const before = new Set<string>();
    for (const d of ctx.before.declarations) {
      if (!localKinds.has(d.kind)) continue;
      if (shadowsGlobal(d, ctx.before)) before.add(localKey(d));
    }
    for (const d of ctx.after.declarations) {
      if (!localKinds.has(d.kind)) continue;
      if (!shadowsGlobal(d, ctx.after)) continue;
      if (before.has(localKey(d))) continue;
      const g = ctx.after.globals.get(d.name);
      findings.push({
        severity: 'warn',
        category: 'VARIABLE_SHADOWING',
        file: d.file,
        line: d.line,
        summary: `${d.name} (${d.kind}) shadows a global of the same name`,
        detail:
          'A local declaration with the same name as a global variable hides the global inside this POU. Either rename the local or remove it if the intent is to use the global.',
        related: g ? [{ file: g.file, line: g.line, note: 'shadowed global' }] : undefined,
      });
    }
    return findings;
  },
};
