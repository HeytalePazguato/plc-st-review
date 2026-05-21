import { NODE, childrenOf } from '../grammar.js';
import type { StNode } from '../types.js';

/**
 * Control structures that increase nesting depth. Clauses that belong to a
 * construct (`elsif_clause`, `else_clause`, `case_clause`) do not add depth on
 * their own, only the structure they live in does.
 */
const NESTING_NODES = new Set<string>([
  NODE.IF_STATEMENT,
  NODE.FOR_STATEMENT,
  NODE.WHILE_STATEMENT,
  NODE.REPEAT_STATEMENT,
  NODE.CASE_STATEMENT,
]);

/**
 * Maximum depth of nested control structures in a POU subtree. A POU with no
 * control flow returns 0; a single un-nested IF returns 1.
 */
export function maxNestingDepth(pou: StNode): number {
  let max = 0;
  const walk = (node: StNode, depth: number): void => {
    const here = NESTING_NODES.has(node.type) ? depth + 1 : depth;
    if (here > max) max = here;
    for (const child of childrenOf(node)) walk(child, here);
  };
  for (const child of childrenOf(pou)) walk(child, 0);
  return max;
}
