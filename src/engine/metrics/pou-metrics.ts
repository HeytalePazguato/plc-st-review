import { NODE, descendantsOfAnyType, findIdentifierText } from '../grammar.js';
import type { AstFile, ReviewContext, StNode } from '../types.js';
import { cyclomaticComplexity } from './complexity.js';
import { locMetrics } from './loc.js';
import { maxNestingDepth } from './nesting.js';

export interface PouMetrics {
  name: string;
  file: string;
  line: number;
  complexity: number;
  nestingDepth: number;
  loc: number;
  locTotal: number;
  commentRatio: number;
}

/**
 * The POU kinds metrics are reported for. METHODs are intentionally not listed
 * here: their bodies roll up into the enclosing FUNCTION_BLOCK's metrics in
 * Phase 1. Per-method granularity is a Phase 2 concern.
 */
const TOP_LEVEL_POU_NODES = new Set<string>([
  NODE.PROGRAM,
  NODE.FUNCTION,
  NODE.FUNCTION_BLOCK,
]);

/** Compute per-POU metrics for one parsed file, keyed by POU name. */
export function computeFileMetrics(file: AstFile): Map<string, PouMetrics> {
  const out = new Map<string, PouMetrics>();
  for (const pou of descendantsOfAnyType(file.root, TOP_LEVEL_POU_NODES)) {
    const name = findIdentifierText(pou);
    if (!name) continue;
    out.set(name, metricsForPou(pou, name, file));
  }
  return out;
}

export interface PouMetricDelta {
  name: string;
  before: PouMetrics;
  after: PouMetrics;
}

/**
 * Yield every POU that exists in both revisions of a changed file, paired with
 * its before/after metrics. This is the unit the metric-regression checks
 * compare. POUs added or deleted in the PR are skipped (no pair to diff), as
 * are files present on only one side.
 */
export function matchedPouMetrics(ctx: ReviewContext): PouMetricDelta[] {
  const out: PouMetricDelta[] = [];
  for (const pair of ctx.pairs) {
    if (!pair.before || !pair.after) continue;
    const before = computeFileMetrics(pair.before);
    const after = computeFileMetrics(pair.after);
    for (const [name, afterMetrics] of after) {
      const beforeMetrics = before.get(name);
      if (!beforeMetrics) continue;
      out.push({ name, before: beforeMetrics, after: afterMetrics });
    }
  }
  return out;
}

function metricsForPou(pou: StNode, name: string, file: AstFile): PouMetrics {
  const loc = locMetrics(pou, file.source);
  return {
    name,
    file: file.path,
    line: pou.startPosition.row + 1,
    complexity: cyclomaticComplexity(pou),
    nestingDepth: maxNestingDepth(pou),
    loc: loc.loc,
    locTotal: loc.total,
    commentRatio: loc.commentRatio,
  };
}
