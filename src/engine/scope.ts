import type { SymbolTable } from './types.js';

/**
 * Walk the lexical scope chain from `scope` outward, ending with `'__global'`.
 *
 *   - For a method scope `"FB_X.Method1"`, yields `"FB_X.Method1"`, then the
 *     parent FB `"FB_X"`, then `"__global"`.
 *   - For a top-level POU scope `"FB_X"`, yields `"FB_X"` then `"__global"`.
 *   - For `'__global'` or `'<file>'`, yields just that and `'__global'`.
 *
 * A reference at scope `R` can resolve to declarations in any scope in
 * `chain(R)`. Equivalently, a declaration at scope `S` is reachable from any
 * scope whose chain contains `S` (i.e. `S` and its descendants).
 */
export function* scopeChain(scope: string, t: SymbolTable): Iterable<string> {
  const seen = new Set<string>();
  let cur: string | undefined = scope;
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    yield cur;
    cur = t.pous.get(cur)?.parent;
  }
  if (!seen.has('__global')) yield '__global';
}
