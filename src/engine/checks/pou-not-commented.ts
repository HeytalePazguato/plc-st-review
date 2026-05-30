import type { Check, Finding, Pou, SymbolTable } from '../types.js';

/**
 * A POU is "commented" if a comment node appears on the same line as its
 * declaration or on any of the few lines immediately above it.
 */
function hasLeadingComment(pou: Pou, t: SymbolTable): boolean {
  const WINDOW = 6;
  for (const c of t.comments) {
    if (c.file !== pou.file) continue;
    if (c.line >= pou.line - WINDOW && c.line <= pou.line) return true;
  }
  return false;
}

function key(p: Pou): string {
  return `${p.file}::${p.qualifiedName}`;
}

export const pouNotCommented: Check = {
  category: 'POU_NOT_COMMENTED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const p of ctx.before.pous.values()) {
      if (!hasLeadingComment(p, ctx.before)) beforeBad.add(key(p));
    }
    for (const p of ctx.after.pous.values()) {
      // Methods and interfaces follow the same rule, but skip
      // method-signatures inside an interface — those are commented at the
      // interface level rather than per-signature.
      if (p.kind === 'interface') continue;
      if (hasLeadingComment(p, ctx.after)) continue;
      if (beforeBad.has(key(p))) continue;
      findings.push({
        severity: 'info',
        category: 'POU_NOT_COMMENTED',
        file: p.file,
        line: p.line,
        summary: `${p.kind} ${p.qualifiedName} has no leading comment (PLCopen C2)`,
        detail:
          'PLCopen C2: every code element should carry a header comment describing its purpose, inputs/outputs, and any preconditions. A comment above the POU keyword (or on the same line) satisfies this check.',
      });
    }
    return findings;
  },
};
