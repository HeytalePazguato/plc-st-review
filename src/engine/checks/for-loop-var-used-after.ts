import type { Check, Finding, SymbolTable, VarReference } from '../types.js';

interface Violation {
  file: string;
  line: number;
  scope: string;
  loopVar: string;
}

/**
 * For each FOR loop, scan references whose name matches the loop counter
 * within the same scope. The collector now records the loop's actual
 * `END_FOR` line (via the AST node's `endPosition`), so a reference past
 * that line is post-loop with no false positives from long loop bodies.
 *
 * Earlier revisions used a fixed 200-line "body window" because the loop's
 * end wasn't tracked. That heuristic produced false positives on POUs
 * whose FOR body exceeded the window — a legitimate ref inside the body,
 * but >200 lines below the `FOR` header, was wrongly flagged as
 * post-loop. The fixed-window approach is gone.
 */
function violations(t: SymbolTable): Violation[] {
  const out: Violation[] = [];
  for (const loop of t.forLoops) {
    for (const ref of t.varReferences) {
      if (ref.file !== loop.file) continue;
      if (ref.scope !== loop.scope) continue;
      if (ref.name.toLowerCase() !== loop.loopVar.toLowerCase()) continue;
      // The loop spans `[loop.line, loop.endLine]` (FOR header through the
      // matching END_FOR, inclusive). Refs strictly past endLine are
      // post-loop; everything else is inside the body.
      if (ref.line <= loop.endLine) continue;
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
