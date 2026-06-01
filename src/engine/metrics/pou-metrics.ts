import { NODE, childrenOf, descendantsOfAnyType, findIdentifierText } from '../grammar.js';
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
  statementCount: number;
  branchCount: number;
  returnCount: number;
}

const STATEMENT_NODES = new Set<string>([
  NODE.ASSIGNMENT_STATEMENT,
  NODE.INVOCATION_STATEMENT,
  NODE.IF_STATEMENT,
  NODE.CASE_STATEMENT,
  NODE.FOR_STATEMENT,
  NODE.WHILE_STATEMENT,
  NODE.REPEAT_STATEMENT,
  NODE.RETURN_STATEMENT,
  NODE.EXIT_STATEMENT,
  NODE.CONTINUE_STATEMENT,
]);

const BRANCH_NODES = new Set<string>([
  NODE.IF_STATEMENT,
  NODE.ELSIF_CLAUSE,
  NODE.ELSE_CLAUSE,
  NODE.CASE_CLAUSE,
]);

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

/**
 * Compute per-POU metrics for one parsed file, keyed by **qualified** POU
 * name (`Namespace.FB_X`, or just `FB_X` outside a namespace). Keying by bare
 * name silently dropped one of two same-named POUs in different namespaces in
 * the same file (L15); keying by qualified name matches what `symbols.pous`
 * already does and lets the namespaced FBs both surface in `--metrics`.
 */
export function computeFileMetrics(file: AstFile): Map<string, PouMetrics> {
  const out = new Map<string, PouMetrics>();
  for (const pou of descendantsOfAnyType(file.root, TOP_LEVEL_POU_NODES)) {
    const name = findIdentifierText(pou);
    if (!name) continue;
    const qualified = qualifiedPouName(pou, name);
    out.set(qualified, metricsForPou(pou, qualified, file));
  }
  return out;
}

/**
 * Build the qualified name for a POU node by walking up its parent chain
 * collecting any enclosing `namespace` nodes (innermost first). `FB_X` inside
 * `NAMESPACE NS1` becomes `NS1.FB_X`; nested namespaces yield `Outer.Inner.FB_X`.
 */
function qualifiedPouName(pou: StNode, name: string): string {
  const segments: string[] = [];
  let cur: StNode | null | undefined = pou.parent ?? null;
  while (cur) {
    if (cur.type === NODE.NAMESPACE) {
      const nsName = findIdentifierText(cur);
      if (nsName) segments.unshift(nsName);
    }
    cur = cur.parent ?? null;
  }
  return segments.length ? `${segments.join('.')}.${name}` : name;
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
  const counts = countNodes(pou);
  return {
    name,
    file: file.path,
    line: pou.startPosition.row + 1,
    complexity: cyclomaticComplexity(pou),
    nestingDepth: maxNestingDepth(pou),
    loc: loc.loc,
    locTotal: loc.total,
    commentRatio: loc.commentRatio,
    statementCount: counts.statements,
    branchCount: counts.branches,
    returnCount: counts.returns,
  };
}

function countNodes(pou: StNode): {
  statements: number;
  branches: number;
  returns: number;
} {
  let statements = 0;
  let branches = 0;
  let returns = 0;
  const stack: StNode[] = [...childrenOf(pou)];
  while (stack.length) {
    const n = stack.pop()!;
    if (STATEMENT_NODES.has(n.type)) statements += 1;
    if (BRANCH_NODES.has(n.type)) branches += 1;
    if (n.type === NODE.RETURN_STATEMENT) returns += 1;
    for (const c of childrenOf(n)) stack.push(c);
  }
  return { statements, branches, returns };
}
