import type { AddressOfExpr, Check, Finding, SymbolTable } from '../types.js';

// Resolve the addressed operand to a VAR_GLOBAL CONSTANT, if it is one.
// The operand may be a bare global name; member access (`T1.PT`) and
// locals are not constants in the global table, so they fall through.
function constantName(expr: AddressOfExpr, t: SymbolTable): string | null {
  const bare = expr.operand.split(/[.[\s]/)[0];
  if (!bare) return null;
  const g = t.globals.get(bare);
  return g?.constant ? bare : null;
}

function key(expr: AddressOfExpr): string {
  return `${expr.file}::${expr.scope}::${expr.line}::${expr.operand}`;
}

export const addressOfConstant: Check = {
  category: 'ADDRESS_OF_CONSTANT',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const expr of ctx.before.addressOfExprs) {
      if (constantName(expr, ctx.before)) before.add(key(expr));
    }
    for (const expr of ctx.after.addressOfExprs) {
      const name = constantName(expr, ctx.after);
      if (!name) continue;
      if (before.has(key(expr))) continue;
      findings.push({
        severity: 'warn',
        category: 'ADDRESS_OF_CONSTANT',
        file: expr.file,
        line: expr.line,
        summary: `ADR(${name}) — taking the address of a CONSTANT`,
        detail:
          'A CONSTANT may live in flash/read-only storage on some runtimes; dereferencing a pointer derived from it can fault. If you need a mutable copy, declare a regular VAR_GLOBAL initialised to the constant.',
      });
    }
    return findings;
  },
};
