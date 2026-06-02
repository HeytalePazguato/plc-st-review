import { scopeChain } from '../scope.js';
import type { Check, Finding, SymbolTable } from '../types.js';

/**
 * Count references whose lexical scope chain includes `targetScope` — i.e.
 * references inside the same POU or any method nested in it. Stops scanning
 * once the count reaches `cap` so the caller can short-circuit on "used".
 */
function countRefsInScope(
  name: string,
  file: string,
  targetScope: string,
  t: SymbolTable,
  cap: number,
): number {
  const lower = name.toLowerCase();
  const reachable = new Map<string, boolean>(); // ref.scope -> whether targetScope is in its chain
  const inChain = (refScope: string): boolean => {
    const cached = reachable.get(refScope);
    if (cached !== undefined) return cached;
    let hit = false;
    for (const s of scopeChain(refScope, t)) {
      if (s === targetScope) {
        hit = true;
        break;
      }
    }
    reachable.set(refScope, hit);
    return hit;
  };
  let count = 0;
  for (const ref of t.varReferences) {
    if (ref.file !== file) continue;
    if (ref.name.toLowerCase() !== lower) continue;
    if (!inChain(ref.scope)) continue;
    count++;
    if (count >= cap) return count;
  }
  return count;
}

export const unusedVarIntroduced: Check = {
  category: 'UNUSED_VAR_INTRODUCED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [scope, locals] of ctx.after.pouLocals) {
      const beforeLocals = new Set(
        (ctx.before.pouLocals.get(scope) ?? []).map((l) => l.name.toLowerCase()),
      );
      const newLocals = locals.filter((l) => !beforeLocals.has(l.name.toLowerCase()));
      if (newLocals.length === 0) continue;
      for (const v of newLocals) {
        // The declaration itself contributes one identifier ref, so 2+ uses in
        // the declaration's scope (or any nested method) means it's used.
        const count = countRefsInScope(v.name, v.file, scope, ctx.after, 2);
        if (count >= 2) continue;
        findings.push({
          severity: 'info',
          category: 'UNUSED_VAR_INTRODUCED',
          file: v.file,
          line: v.line,
          summary: `Variable ${v.name} introduced in ${scope} but not referenced`,
          detail: 'Either remove the declaration or add a use of it.',
        });
      }
    }
    return findings;
  },
};
