import type { Check, Finding, SymbolTable, VarReference } from '../types.js';

interface Violation {
  file: string;
  line: number;
  scope: string;
  loopVar: string;
}

/**
 * For each FOR loop, scan references whose name matches the loop counter
 * within the same scope. The engine doesn't track each loop's end line
 * precisely, so a reference is reported when it sits well below the loop's
 * declaration line but inside the same POU — a heuristic that catches the
 * common "I'll use `i` after the loop" mistake without firing on each
 * iteration step inside the body.
 */
function violations(t: SymbolTable): Violation[] {
  const out: Violation[] = [];
  const BODY_WINDOW = 200; // lines below the FOR considered the loop body
  for (const loop of t.forLoops) {
    for (const ref of t.varReferences) {
      if (ref.file !== loop.file) continue;
      if (ref.scope !== loop.scope) continue;
      if (ref.name.toLowerCase() !== loop.loopVar.toLowerCase()) continue;
      // The declaration / FOR header itself sits at loop.line; refs there
      // are part of the loop, not "after". Anything within BODY_WINDOW is
      // assumed to still be the body (POU-aware end-line tracking is on the
      // backlog). Past that, the ref is post-loop.
      if (ref.line <= loop.line + BODY_WINDOW) continue;
      out.push({
        file: loop.file,
        line: ref.line,
        scope: loop.scope,
        loopVar: loop.loopVar,
      });
    }
  }
  return out;
}

function key(v: { file: string; line: number; loopVar: string }): string {
  return `${v.file}::${v.line}::${v.loopVar.toLowerCase()}`;
}

function rKey(r: VarReference): string {
  return `${r.file}::${r.line}::${r.name.toLowerCase()}`;
}

export const forLoopVarUsedAfter: Check = {
  category: 'FOR_LOOP_VAR_USED_AFTER',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(
      ctx.before.varReferences.map(rKey),
    );
    const seen = new Set<string>();
    for (const v of violations(ctx.after)) {
      const k = key(v);
      if (seen.has(k)) continue;
      if (before.has(`${v.file}::${v.line}::${v.loopVar.toLowerCase()}`)) continue;
      seen.add(k);
      findings.push({
        severity: 'info',
        category: 'FOR_LOOP_VAR_USED_AFTER',
        file: v.file,
        line: v.line,
        summary: `FOR-loop counter '${v.loopVar}' read after the loop terminates (PLCopen L13)`,
        detail:
          'PLCopen L13: the value of a FOR-loop counter after the loop is implementation-defined (it may be `end`, `end + step`, or whatever the runtime decided). Don\'t depend on it; if you need the post-loop value, compute it explicitly.',
      });
    }
    return findings;
  },
};
