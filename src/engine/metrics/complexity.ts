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
 * 1 for every `AND` / `OR` / `XOR` / `&` operator inside a binary expression.
 * IEC 61131-3 treats `&` as a synonym for `AND` on BOOL operands, and `XOR`
 * as a logical operator, so all four create a decision branch in the
 * truthiness lattice and should each bump the count. The grammar exposes the
 * operator only as an anonymous token (verified: token types are exactly
 * `AND` / `OR` / `XOR` / `&`), so we read the full child list rather than the
 * named children to recognise it.
 */
const LOGICAL_OP_TYPES = new Set<string>(['AND', 'OR', 'XOR', '&']);

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
    // `&` is case-irrelevant; `AND` / `OR` / `XOR` keywords come through the
    // grammar uppercase regardless of source casing, but we upper-case
    // defensively in case a future grammar change preserves source casing.
    const t = child.type === '&' ? '&' : child.type.toUpperCase();
    if (LOGICAL_OP_TYPES.has(t)) return true;
  }
  return false;
}
