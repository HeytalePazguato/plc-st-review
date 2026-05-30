import type { BinaryExpression, Check, Finding, SymbolTable } from '../types.js';

const COMPARE_OPS = new Set<string>(['<', '>', '<=', '>=']);

function pointerNames(t: SymbolTable): Set<string> {
  const out = new Set<string>();
  for (const p of t.pointerVars) out.add(p.name.toLowerCase());
  return out;
}

function firstSegment(text: string): string {
  const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(text.trim());
  return (m?.[1] ?? '').toLowerCase();
}

function involvesPointer(b: BinaryExpression, ptrs: Set<string>): boolean {
  return ptrs.has(firstSegment(b.leftText)) || ptrs.has(firstSegment(b.rightText));
}

function key(b: BinaryExpression): string {
  return `${b.file}::${b.line}::${b.op}::${b.leftText}::${b.rightText}`;
}

export const pointerCompared: Check = {
  category: 'POINTER_COMPARED',
  defaultSeverity: 'warn',
  run(ctx) {
    const beforePtrs = pointerNames(ctx.before);
    const afterPtrs = pointerNames(ctx.after);
    const findings: Finding[] = [];
    const before = new Set(
      ctx.before.binaryExpressions
        .filter((b) => COMPARE_OPS.has(b.op) && involvesPointer(b, beforePtrs))
        .map(key),
    );
    for (const b of ctx.after.binaryExpressions) {
      if (!COMPARE_OPS.has(b.op)) continue;
      if (!involvesPointer(b, afterPtrs)) continue;
      if (before.has(key(b))) continue;
      findings.push({
        severity: 'warn',
        category: 'POINTER_COMPARED',
        file: b.file,
        line: b.line,
        summary: `Relational comparison of pointer '${b.leftText} ${b.op} ${b.rightText}' (PLCopen E3)`,
        detail:
          'PLCopen E3: `<`, `>`, `<=`, `>=` on POINTER values is non-portable — the runtime\'s address ordering isn\'t guaranteed. Compare for equality (`=` / `<>`) only, or compare values they point at instead.',
      });
    }
    return findings;
  },
};
