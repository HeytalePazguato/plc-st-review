import { buildCallGraph } from '../metrics/callgraph.js';
import type { Check, Finding } from '../types.js';

const KINDS = new Set<string>(['function', 'function_block']);

/**
 * Flags a POU added in this PR that nothing in the whole project calls.
 * Project-scoped: it needs `ctx.project` (the whole-repo symbol table) to know
 * about callers in files the diff didn't touch, so without `--project-scope`
 * the engine skips it rather than risk a false "nobody calls this". PROGRAMs
 * are excluded, they are entry points. Info-level: an unwired block can be
 * intentional.
 */
export const deadPouIntroduced: Check = {
  category: 'DEAD_POU_INTRODUCED',
  defaultSeverity: 'info',
  scope: 'project',
  run(ctx) {
    if (!ctx.project) return [];
    const findings: Finding[] = [];
    const graph = buildCallGraph(ctx.project);
    for (const [name, pou] of ctx.after.pous) {
      if (!KINDS.has(pou.kind)) continue;
      if (ctx.before.pous.has(name)) continue; // existed before; not introduced here
      if ((graph.fanIn.get(name) ?? 0) > 0) continue;
      findings.push({
        severity: 'info',
        category: 'DEAD_POU_INTRODUCED',
        file: pou.file,
        line: pou.line,
        summary: `${name} was added but nothing in the project calls it`,
        detail:
          'No call site anywhere in the project resolves to this POU. This may be intentional ' +
          '(a block to be wired up later) or a leftover. Info-level only.',
      });
    }
    return findings;
  },
};
