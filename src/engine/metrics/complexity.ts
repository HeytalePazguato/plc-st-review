import { NODE, allChildrenOf, childrenOf } from '../grammar.js';
import type { StNode } from '../types.js';

/**
 * Decision points that each add 1 to cyclomatic complexity. Note that a
 * `case_statement` itself is NOT counted, each `case_clause` (arm) is, per
 * McCabe adapted for ST. `else_clause` is not a decision point.
 */
const DECISION_NODES = new Set<string>([
  NODE.IF_STATEMENT,
  NODE.ELSIF_CLAUSE,
  NODE.FOR_STATEMENT,
  NODE.WHILE_STATEMENT,
  NODE.REPEAT_STATEMENT,
  NODE.CASE_CLAUSE,
]);

/**
 * McCabe cyclomatic complexity for a single POU subtree: start at 1, add 1
 * for every decision point (IF, ELSIF, FOR, WHILE, REPEAT, each CASE arm) and
 * 1 for every `AND`/`OR` operator inside a boolean expression. The grammar
 * exposes the operator only as an anonymous token, so we read the full child
 * list rather than the named children to recognise it.
 */
export function cyclomaticComplexity(pou: StNode): number {
  let complexity = 1;
  const stack: StNode[] = [...childrenOf(pou)];
  while (stack.length) {
    const n = stack.pop()!;
    if (DECISION_NODES.has(n.type)) complexity += 1;
    if (n.type === NODE.BINARY_EXPRESSION && isLogicalOperator(n)) complexity += 1;
    for (const c of childrenOf(n)) stack.push(c);
  }
  return complexity;
}

function isLogicalOperator(binary: StNode): boolean {
  for (const child of allChildrenOf(binary)) {
    const t = child.type.toUpperCase();
    if (t === 'AND' || t === 'OR') return true;
  }
  return false;
}
