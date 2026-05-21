import { matchedPouMetrics } from '../metrics/pou-metrics.js';
import type { Check, Finding } from '../types.js';

/**
 * Flags a POU whose maximum control-structure nesting depth increased and now
 * sits beyond the configured warn threshold (default 5). Escalates to error
 * when the new depth newly crosses the error threshold (default 8).
 */
export const nestingIncreased: Check = {
  category: 'NESTING_INCREASED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const { warn: warnThreshold, error: errorThreshold } =
      ctx.config.metricsThresholds.nestingDepth;
    for (const { name, before, after } of matchedPouMetrics(ctx)) {
      if (after.nestingDepth <= before.nestingDepth) continue;
      if (after.nestingDepth <= warnThreshold) continue;
      const crossedError =
        after.nestingDepth >= errorThreshold && before.nestingDepth < errorThreshold;
      findings.push({
        severity: crossedError ? 'error' : 'warn',
        category: 'NESTING_INCREASED',
        file: after.file,
        line: after.line,
        summary: `${name} max nesting depth: ${before.nestingDepth} → ${after.nestingDepth}` +
          (crossedError
            ? ` (crossed error threshold of ${errorThreshold})`
            : ` (warn threshold ${warnThreshold})`),
        detail:
          'Deep nesting hurts readability. Consider guard clauses or extracting inner blocks into methods.',
      });
    }
    return findings;
  },
};
