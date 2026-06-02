import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

function localKey(d: NamedDecl): string {
  return `${d.file}::${d.scope}::${d.name.toLowerCase()}`;
}

function shadowsGlobal(d: NamedDecl, t: SymbolTable): boolean {
  if (d.scope === '__global') return false;
  // The globals map normalizes its own keys per the configured case mode, so a
  // single lookup is correct: case-insensitive dialects match `Level`/`level`,
  // case-sensitive dialects (B&R) require an exact match.
  return t.globals.has(d.name);
}

export const variableShadowing: Check = {
  category: 'VARIABLE_SHADOWING',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    // Every declaration kind that occupies a POU's local namespace and can
    // therefore shadow a global of the same name — both value kinds (locals,
    // params, temps) AND instance kinds (FB/timer/counter/edge-trig/bistable
    // instances). The latter were missing in earlier versions, so a local
    // `myPump : FB_Pump;` declared in a POU was not flagged when a global of
    // the same name existed; this set closes that gap.
    const localKinds = new Set<NamedDecl['kind']>([
      'var_local', 'var_input', 'var_output', 'var_in_out', 'var_temp',
      'fb_instance', 'timer_instance', 'counter_instance',
      'edge_trig_instance', 'bistable_instance',
    ]);
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
