import type { AssignmentTarget, Check, Finding, SymbolTable } from '../types.js';

interface Violation {
  file: string;
  line: number;
  scope: string;
  loopVar: string;
}

/**
 * For each FOR loop, look for assignments whose left-hand side is the loop
 * counter and whose source line falls inside the loop's recorded scope.
 * The engine doesn't track loop-body line ranges, so this is a conservative
 * heuristic: an assignment to the loop var inside the *same scope* (same
 * POU) on a line above the next outer `FOR` of the same scope and after
 * this loop's start.
 */
function violations(t: SymbolTable): Violation[] {
  const out: Violation[] = [];
  for (const loop of t.forLoops) {
    for (const a of t.assignmentTargets) {
      if (a.file !== loop.file) continue;
      if (a.scope !== loop.scope) continue;
      if (a.line <= loop.line) continue;
      if (a.name.toLowerCase() !== loop.loopVar.toLowerCase()) continue;
      out.push({
        file: loop.file,
        line: a.line,
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

function aKey(a: AssignmentTarget): string {
  return `${a.file}::${a.line}::${a.name.toLowerCase()}`;
}

export const forLoopVarModified: Check = {
  category: 'FOR_LOOP_VAR_MODIFIED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(violations(ctx.before).map(key));
    const seen = new Set<string>();
    for (const v of violations(ctx.after)) {
      const k = key(v);
      if (before.has(k)) continue;
      if (seen.has(k)) continue;
      // Suppress when the assignment site was already present in `before`
      // (the loop var was modified before this PR introduced the issue).
      const wasAssigned = ctx.before.assignmentTargets.some(
        (a) => aKey(a) === `${v.file}::${v.line}::${v.loopVar.toLowerCase()}`,
      );
      if (wasAssigned) continue;
      seen.add(k);
      findings.push({
        severity: 'warn',
        category: 'FOR_LOOP_VAR_MODIFIED',
        file: v.file,
        line: v.line,
        summary: `FOR-loop counter '${v.loopVar}' assigned inside the loop body (PLCopen L12)`,
        detail:
          'PLCopen L12: a FOR-loop counter should not be modified inside the loop body. Mutating it skips iterations, runs forever, or otherwise breaks the loop\'s contract. Use a WHILE loop if the iteration count is genuinely dynamic.',
      });
    }
    return findings;
  },
};
