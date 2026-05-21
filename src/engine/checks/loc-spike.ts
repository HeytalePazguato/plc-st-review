import { matchedPouMetrics } from '../metrics/pou-metrics.js';
import type { Check, Finding } from '../types.js';

/** A POU must grow by more than this fraction of its prior LOC to be flagged. */
const SPIKE_RATIO = 0.5;

/**
 * Flags a POU whose lines of code grew by more than 50% in a single PR, a
 * signal that a lot of code landed in one change. Informational only.
 */
export const locSpike: Check = {
  category: 'LOC_SPIKE',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    for (const { name, before, after } of matchedPouMetrics(ctx)) {
      if (before.loc <= 0 || after.loc <= before.loc) continue;
      const growth = (after.loc - before.loc) / before.loc;
      if (growth <= SPIKE_RATIO) continue;
      const pct = Math.round(growth * 100);
      findings.push({
        severity: 'info',
        category: 'LOC_SPIKE',
        file: after.file,
        line: after.line,
        summary: `${name} lines of code: ${before.loc} → ${after.loc} (+${pct}%)`,
        detail:
          'A large amount of code was added to one POU in a single change. Worth confirming it is not several concerns merged together.',
      });
    }
    return findings;
  },
};
