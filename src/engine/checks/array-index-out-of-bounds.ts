import type { ArrayAccess, ArrayDecl, Check, Finding } from '../types.js';

function findArrayDecl(name: string, decls: readonly ArrayDecl[]): ArrayDecl | null {
  for (const d of decls) {
    if (d.varName.toLowerCase() === name.toLowerCase()) return d;
  }
  return null;
}

function isOOB(acc: ArrayAccess, decl: ArrayDecl): boolean {
  if (acc.indexValue === null) return false;
  const lo = Number.parseFloat(decl.lower);
  const hi = Number.parseFloat(decl.upper);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
  return acc.indexValue < lo || acc.indexValue > hi;
}

function key(acc: ArrayAccess): string {
  return `${acc.file}::${acc.scope}::${acc.arrayName}::${acc.indexText}::${acc.line}`;
}

export const arrayIndexOutOfBounds: Check = {
  category: 'ARRAY_INDEX_OUT_OF_BOUNDS',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const acc of ctx.before.arrayAccesses) {
      const decl = findArrayDecl(acc.arrayName, ctx.before.arrayDecls);
      if (decl && isOOB(acc, decl)) beforeBad.add(key(acc));
    }
    for (const acc of ctx.after.arrayAccesses) {
      const decl = findArrayDecl(acc.arrayName, ctx.after.arrayDecls);
      if (!decl) continue;
      if (!isOOB(acc, decl)) continue;
      if (beforeBad.has(key(acc))) continue;
      findings.push({
        severity: 'error',
        category: 'ARRAY_INDEX_OUT_OF_BOUNDS',
        file: acc.file,
        line: acc.line,
        summary: `${acc.arrayName}[${acc.indexText}] is out of declared bounds [${decl.lower}..${decl.upper}]`,
        detail:
          'Only literal indices are checked; dynamic indices (variables) require flow analysis and are skipped.',
        related: [
          { file: decl.file, line: decl.line, note: 'array declaration' },
        ],
      });
    }
    return findings;
  },
};
