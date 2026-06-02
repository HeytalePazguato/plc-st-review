import type { BinaryExpression, Check, Finding, SymbolTable } from '../types.js';

const ARITH_OPS = new Set<string>(['+', '-', '*', '/']);

function pointerNames(t: SymbolTable): Set<string> {
  const out = new Set<string>();
  for (const p of t.pointerVars) out.add(p.name.toLowerCase());
  return out;
}

function firstSegment(text: string): string {
  // For a member-access / index expression, the leading identifier is the
  // variable being operated on. `pAddr.foo` -> `pAddr`; `pAddr[0]` -> `pAddr`.
  const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(text.trim());
  return (m?.[1] ?? '').toLowerCase();
}

function involvesPointer(b: BinaryExpression, ptrs: Set<string>): boolean {
  return ptrs.has(firstSegment(b.leftText)) || ptrs.has(firstSegment(b.rightText));
}

function key(b: BinaryExpression): string {
  return `${b.file}::${b.line}::${b.op}::${b.leftText}::${b.rightText}`;
}

export const pointerArithmetic: Check = {
  category: 'POINTER_ARITHMETIC',
  defaultSeverity: 'warn',
  run(ctx) {
    const beforePtrs = pointerNames(ctx.before);
    const afterPtrs = pointerNames(ctx.after);
    const findings: Finding[] = [];
    const before = new Set(
      ctx.before.binaryExpressions
        .filter((b) => ARITH_OPS.has(b.op) && involvesPointer(b, beforePtrs))
        .map(key),
    );
    for (const b of ctx.after.binaryExpressions) {
      if (!ARITH_OPS.has(b.op)) continue;
      if (!involvesPointer(b, afterPtrs)) continue;
      if (before.has(key(b))) continue;
      findings.push({
        severity: 'warn',
        category: 'POINTER_ARITHMETIC',
        file: b.file,
        line: b.line,
        summary: `Pointer arithmetic on '${b.leftText} ${b.op} ${b.rightText}' (PLCopen E2)`,
        detail:
          'PLCopen E2: arithmetic on POINTER-typed values is non-portable across vendor runtimes (sizes and stride differ) and most "I need to compute an offset" code is better written by indexing into a sized array. Prefer ARRAY indexing or a typed buffer wrapper over `pAddr + n`.',
      });
    }
    return findings;
  },
};
