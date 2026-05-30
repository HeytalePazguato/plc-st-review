import { scopeChain } from '../scope.js';
import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

type ScopeDecls = Map<string, Map<string, NamedDecl>>; // scope -> lowerName -> decl

function declsByScope(t: SymbolTable): ScopeDecls {
  const out: ScopeDecls = new Map();
  for (const d of t.declarations) {
    let inner = out.get(d.scope);
    if (!inner) {
      inner = new Map();
      out.set(d.scope, inner);
    }
    const k = d.name.toLowerCase();
    // First declaration with a given name in a given scope wins; that's the
    // canonical casing the check measures references against.
    if (!inner.has(k)) inner.set(k, d);
  }
  return out;
}

/**
 * Resolve a reference to the declaration it sees, walking the lexical scope
 * chain so a `count` in POU A is matched against POU A's own decl rather than
 * whatever first appeared in another POU. Returns null when no declaration in
 * scope matches.
 */
function resolveRef(
  refName: string,
  refScope: string,
  t: SymbolTable,
  byScope: ScopeDecls,
): NamedDecl | null {
  const k = refName.toLowerCase();
  for (const s of scopeChain(refScope, t)) {
    const m = byScope.get(s);
    const d = m?.get(k);
    if (d) return d;
  }
  return null;
}

function dedupeKey(file: string, line: number, name: string): string {
  return `${file}::${line}::${name}`;
}

export const identifierCaseMismatch: Check = {
  category: 'IDENTIFIER_CASE_MISMATCH',
  defaultSeverity: 'warn',
  run(ctx) {
    // Only meaningful when identifiers are case-insensitive. Under a
    // case-sensitive dialect (e.g. B&R) a differing case is a different (or
    // undefined) symbol, not a style mismatch, so this check does not apply.
    if (ctx.config.caseSensitive) return [];

    const findings: Finding[] = [];
    const afterByScope = declsByScope(ctx.after);
    const beforeByScope = declsByScope(ctx.before);

    // Identify mismatches present in `before` so we don't re-flag legacy cases.
    const beforeBad = new Set<string>();
    for (const ref of ctx.before.varReferences) {
      const d = resolveRef(ref.name, ref.scope, ctx.before, beforeByScope);
      if (d && d.name !== ref.name && d.name.toLowerCase() === ref.name.toLowerCase()) {
        beforeBad.add(dedupeKey(ref.file, ref.line, ref.name));
      }
    }

    const seen = new Set<string>();
    for (const ref of ctx.after.varReferences) {
      const d = resolveRef(ref.name, ref.scope, ctx.after, afterByScope);
      if (!d) continue;
      if (d.name === ref.name) continue;
      // Defensive: must be a true case-only difference, not coincidental.
      if (d.name.toLowerCase() !== ref.name.toLowerCase()) continue;
      const k = dedupeKey(ref.file, ref.line, ref.name);
      if (beforeBad.has(k)) continue;
      // Dedupe per (file, line, name) — multiple identifiers on the same line
      // are common (e.g. `iCount := iCount + 1;`).
      if (seen.has(k)) continue;
      seen.add(k);
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
