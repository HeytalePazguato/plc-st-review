import { buildCallGraph } from '../metrics/callgraph.js';
import type { Check, Finding, SymbolTable } from '../types.js';

function canonicalRotation(arr: readonly string[]): string[] {
  if (arr.length === 0) return [];
  let best = 0;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < arr[best]) best = i;
  }
  return [...arr.slice(best), ...arr.slice(0, best)];
}

function cycleKey(members: readonly string[]): string {
  return canonicalRotation(members).join(' -> ');
}

function cycles(t: SymbolTable): string[][] {
  // CallGraph.cycles returns strongly-connected components with > 1 POU.
  // Self-loops are excluded there too; those are reported by RECURSIVE_CALL.
  return buildCallGraph(t).cycles;
}

export const indirectRecursiveCall: Check = {
  category: 'INDIRECT_RECURSIVE_CALL',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeKeys = new Set(cycles(ctx.before).map(cycleKey));
    for (const members of cycles(ctx.after)) {
      const k = cycleKey(members);
      if (beforeKeys.has(k)) continue;
      // Anchor the finding at the earliest POU in the cycle.
      let entry = members[0];
      for (const m of members) {
        const a = ctx.after.pous.get(m);
        const b = ctx.after.pous.get(entry);
        if (!b) {
          entry = m;
          continue;
        }
        if (a && a.line < b.line) entry = m;
      }
      const pou = ctx.after.pous.get(entry);
      if (!pou) continue;
      const path = [...canonicalRotation(members), canonicalRotation(members)[0]].join(' -> ');
      findings.push({
        severity: 'error',
        category: 'INDIRECT_RECURSIVE_CALL',
        file: pou.file,
        line: pou.line,
        summary: `Indirect recursion: ${path} (PLCopen CP13)`,
        detail:
          'PLCopen CP13: a POU may not call itself, directly or indirectly. Indirect recursion (A calls B, B calls A — possibly through more hops) has the same risk as direct recursion: unbounded stack growth on a runtime that is often single-stack and not designed for it. Break the cycle by extracting the shared work into a third POU.',
      });
    }
    return findings;
  },
};
