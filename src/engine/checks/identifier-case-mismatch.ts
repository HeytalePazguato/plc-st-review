import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

function declMap(t: SymbolTable): Map<string, NamedDecl> {
  const out = new Map<string, NamedDecl>();
  for (const d of t.declarations) {
    // First-seen wins; that's the canonical capitalization.
    if (!out.has(d.name.toLowerCase())) out.set(d.name.toLowerCase(), d);
  }
  return out;
}

function key(file: string, line: number, name: string): string {
  return `${file}::${line}::${name}`;
}

export const identifierCaseMismatch: Check = {
  category: 'IDENTIFIER_CASE_MISMATCH',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const decls = declMap(ctx.after);
    const beforeDecls = declMap(ctx.before);

    // Identify mismatches present in `before` so we don't re-flag legacy cases.
    const beforeBad = new Set<string>();
    for (const ref of ctx.before.varReferences) {
      const d = beforeDecls.get(ref.name.toLowerCase());
      if (d && d.name !== ref.name && d.name.toLowerCase() === ref.name.toLowerCase()) {
        beforeBad.add(key(ref.file, ref.line, ref.name));
      }
    }

    const seen = new Set<string>();
    for (const ref of ctx.after.varReferences) {
      const d = decls.get(ref.name.toLowerCase());
      if (!d) continue;
      if (d.name === ref.name) continue;
      // Only fire on actual case difference, not unrelated names that collide
      // on a case-insensitive compare.
      if (d.name.toLowerCase() !== ref.name.toLowerCase()) continue;
      const k = key(ref.file, ref.line, ref.name);
      if (beforeBad.has(k)) continue;
      // Dedupe per (file, line, name), multiple identifiers on the same line
      // are common (e.g. `iCount := iCount + 1;`).
      const dedupe = `${ref.file}::${ref.line}::${ref.name}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      findings.push({
        severity: 'warn',
        category: 'IDENTIFIER_CASE_MISMATCH',
        file: ref.file,
        line: ref.line,
        summary: `'${ref.name}' uses a different case than its declaration '${d.name}'`,
        detail:
          'IEC 61131-3 identifiers are case-insensitive, but consistent casing helps readability and grep-ability. Match the declared spelling.',
        related: [{ file: d.file, line: d.line, note: 'declaration' }],
      });
    }
    return findings;
  },
};
