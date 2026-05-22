import { matchedPouMetrics } from '../metrics/pou-metrics.js';
import type { Check, Finding } from '../types.js';

/**
 * Flags a POU whose cyclomatic complexity rose between revisions. Warns on any
 * jump greater than 5; escalates to error when the new value newly crosses the
 * configured error threshold (default 25). Small increases are ignored.
 */
export const complexityIncreased: Check = {
  category: 'COMPLEXITY_INCREASED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const errorThreshold = ctx.config.metricsThresholds.cyclomaticComplexity.error;
    for (const { name, before, after } of matchedPouMetrics(ctx)) {
      if (after.complexity <= before.complexity) continue;
      const increase = after.complexity - before.complexity;
      const crossedError =
        after.complexity >= errorThreshold && before.complexity < errorThreshold;
      if (!crossedError && increase <= 5) continue;
      findings.push({
        severity: crossedError ? 'error' : 'warn',
        category: 'COMPLEXITY_INCREASED',
        file: after.file,
        line: after.line,
        summary:
          `${name} cyclomatic complexity: ${before.complexity} → ${after.complexity}` +
          (crossedError
            ? ` (crossed error threshold of ${errorThreshold})`
            : ` (+${increase})`),
        detail: crossedError
          ? `Complexity now exceeds the configured error threshold (${errorThreshold}). ` +
            'Consider extracting methods or flattening branching.'
          : `Complexity rose by ${increase} in this change. Large single-PR jumps are worth a second look.`,
      });
    }
    return findings;
  },
};
