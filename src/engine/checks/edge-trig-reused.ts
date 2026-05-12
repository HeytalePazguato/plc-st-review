import type { Check, EdgeTrigInstance, Finding, SymbolTable } from '../types.js';

function distinctClkExprs(t: EdgeTrigInstance, symbols: SymbolTable): Set<string> {
  const out = new Set<string>();
  for (const cs of symbols.callSites) {
    if (cs.file !== t.file) continue;
    if (cs.callee.toLowerCase() !== t.name.toLowerCase()) continue;
    const clk =
      cs.namedArgs.get('CLK') ?? cs.namedArgs.get('Clk') ?? cs.namedArgs.get('clk');
    if (clk) out.add(clk.trim());
    else if (cs.positionalArgs.length > 0) out.add(cs.positionalArgs[0]);
  }
  return out;
}

function key(t: EdgeTrigInstance): string {
  return `${t.file}::${t.scope}::${t.name}`;
}

export const edgeTrigReused: Check = {
  category: 'EDGE_TRIG_REUSED',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const t of ctx.before.edgeTrigInstances) {
      if (distinctClkExprs(t, ctx.before).size > 1) beforeBad.add(key(t));
    }
    for (const t of ctx.after.edgeTrigInstances) {
      const exprs = distinctClkExprs(t, ctx.after);
      if (exprs.size <= 1) continue;
      if (beforeBad.has(key(t))) continue;
      findings.push({
        severity: 'error',
        category: 'EDGE_TRIG_REUSED',
        file: t.file,
        line: t.line,
        summary: `${t.trigType} instance ${t.name} is reused with ${exprs.size} different CLK expressions`,
        detail: `CLK values seen: ${[...exprs].join(', ')}. An edge-trigger holds internal state; mixing inputs scrambles the edge detection. Declare one instance per CLK source.`,
      });
    }
    return findings;
  },
};
