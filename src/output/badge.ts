import type { MetricsResult } from '../engine/metrics/index.js';
import type { MetricsThresholds } from '../engine/types.js';

/**
 * A shields.io badge URL for the project's average complexity, coloured by the
 * configured complexity bands. Embed in a README:
 * `![Avg Complexity](<url>)`.
 */
export function renderBadge(
  result: MetricsResult,
  thresholds: MetricsThresholds,
): string {
  const value = result.aggregate.avgComplexity;
  const color =
    value >= thresholds.cyclomaticComplexity.error
      ? 'red'
      : value >= thresholds.cyclomaticComplexity.warn
        ? 'yellow'
        : 'brightgreen';
  const label = encodeURIComponent('avg complexity');
  const message = encodeURIComponent(String(value));
  return `https://img.shields.io/badge/${label}-${message}-${color}`;
}
