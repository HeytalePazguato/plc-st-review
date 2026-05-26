import type { CallSite, SymbolTable } from '../types.js';

/**
 * POU-to-POU call graph derived from the symbol table. Nodes are the callable
 * top-level POUs (PROGRAM / FUNCTION / FUNCTION_BLOCK); METHODs and INTERFACEs
 * are not nodes, a call into a method resolves to its owning FB type. Self
 * recursion is excluded from edges (it is `RECURSIVE_CALL`'s job) but still
 * surfaces in `cycles` as a single-node loop is not reported.
 */
export interface CallGraph {
  nodes: string[];
  /** caller POU -> set of distinct callee POUs (self-edges excluded). */
  adjacency: Map<string, Set<string>>;
  fanIn: Map<string, number>;
  fanOut: Map<string, number>;
  /**
   * FUNCTION / FUNCTION_BLOCK POUs that nothing calls (PROGRAMs excluded). A
   * POU reached only through `EXTENDS` / `IMPLEMENTS` is NOT dead: it is used,
   * just not via a call site. Base classes and implemented FBs are therefore
   * excluded even though their call fan-in is zero.
   */
  deadPous: string[];
  /** Strongly-connected components with more than one POU (mutual recursion). */
  cycles: string[][];
  /** POU count along the longest call chain (A->B->C = 3). */
  dependencyDepth: number;
}

const NODE_KINDS = new Set<string>(['program', 'function', 'function_block']);

function owningType(scope: string): string {
  return scope.includes('.') ? scope.split('.')[0] : scope;
}

export function buildCallGraph(table: SymbolTable): CallGraph {
  const nodes: string[] = [];
  const byLower = new Map<string, string>();
  for (const p of table.pous.values()) {
    if (!NODE_KINDS.has(p.kind)) continue;
    nodes.push(p.name);
    byLower.set(p.name.toLowerCase(), p.name);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const n of nodes) adjacency.set(n, new Set());

  for (const cs of table.callSites) {
    if (!cs.scope || cs.scope === '<file>') continue;
    const caller = byLower.get(owningType(cs.scope).toLowerCase());
    if (!caller) continue;
    const callee = resolveCallee(cs, table, byLower);
    if (!callee || callee === caller) continue;
    adjacency.get(caller)!.add(callee);
  }

  const fanOut = new Map<string, number>();
  const fanIn = new Map<string, number>();
  for (const n of nodes) {
    fanOut.set(n, adjacency.get(n)!.size);
    fanIn.set(n, 0);
  }
  for (const callees of adjacency.values()) {
    for (const callee of callees) fanIn.set(callee, (fanIn.get(callee) ?? 0) + 1);
  }

  // A POU named as another POU's base (`EXTENDS`) or implemented interface is
  // "used" even with zero call fan-in, so it is not dead. Inheritance is not a
  // call edge, so it never appears in `adjacency` / `fanIn`; we track it here.
  const inheritedTypes = new Set<string>();
  for (const p of table.pous.values()) {
    if (p.extends) inheritedTypes.add(p.extends.toLowerCase());
    for (const impl of p.implements) inheritedTypes.add(impl.toLowerCase());
  }

  const deadPous = nodes
    .filter(
      (n) =>
        table.pous.get(n)?.kind !== 'program' &&
        (fanIn.get(n) ?? 0) === 0 &&
        !inheritedTypes.has(n.toLowerCase()),
    )
    .sort();

  const { cycles, dependencyDepth } = analyzeStructure(nodes, adjacency);

  return { nodes, adjacency, fanIn, fanOut, deadPous, cycles, dependencyDepth };
}

/**
 * Resolve a call site's callee to a POU name: a direct POU call, or an FB
 * instance (local or global) whose declared type is a POU. Mirrors the
 * resolution used by `RECURSIVE_CALL`. Returns null for library / external
 * calls we can't see.
 */
function resolveCallee(
  cs: CallSite,
  table: SymbolTable,
  byLower: Map<string, string>,
): string | null {
  const callee = cs.callee.toLowerCase();
  const direct = byLower.get(callee);
  if (direct) return direct;

  const firstSeg = callee.includes('.') ? callee.split('.')[0] : callee;
  const locals = table.pouLocals.get(cs.scope) ?? [];
  const local = locals.find((l) => l.name.toLowerCase() === firstSeg);
  if (local) {
    const t = byLower.get(local.typeText.toLowerCase());
    if (t) return t;
  }
  for (const g of table.globals.values()) {
    if (g.name.toLowerCase() === firstSeg) {
      const t = byLower.get(g.typeText.toLowerCase());
      if (t) return t;
    }
  }
  return null;
}

/**
 * Tarjan SCCs to find mutual-recursion cycles, then a longest-path pass over
 * the condensation (a DAG) to get the dependency depth in POU count.
 */
function analyzeStructure(
  nodes: string[],
  adjacency: Map<string, Set<string>>,
): { cycles: string[][]; dependencyDepth: number } {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const comp = new Map<string, number>(); // node -> component id
  const components: string[][] = [];
  let counter = 0;

  const strongConnect = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter += 1;
    stack.push(v);
    onStack.add(v);
    for (const w of adjacency.get(v) ?? []) {
      if (!index.has(w)) {
        strongConnect(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) === index.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.set(w, components.length);
        scc.push(w);
      } while (w !== v);
      components.push(scc);
    }
  };

  for (const n of nodes) if (!index.has(n)) strongConnect(n);

  const cycles = components.filter((c) => c.length > 1).map((c) => [...c].sort());

  // Condensation: component DAG with edges between distinct components.
  const compAdj = new Map<number, Set<number>>();
  for (let i = 0; i < components.length; i++) compAdj.set(i, new Set());
  for (const [from, callees] of adjacency) {
    const cf = comp.get(from)!;
    for (const to of callees) {
      const ct = comp.get(to)!;
      if (cf !== ct) compAdj.get(cf)!.add(ct);
    }
  }

  // Longest weighted path over the DAG, weight = POU count in the component.
  const memo = new Map<number, number>();
  const longestFrom = (c: number): number => {
    const cached = memo.get(c);
    if (cached !== undefined) return cached;
    const weight = components[c].length;
    let best = weight;
    for (const next of compAdj.get(c) ?? []) {
      best = Math.max(best, weight + longestFrom(next));
    }
    memo.set(c, best);
    return best;
  };

  let dependencyDepth = 0;
  for (let i = 0; i < components.length; i++) {
    dependencyDepth = Math.max(dependencyDepth, longestFrom(i));
  }

  return { cycles, dependencyDepth };
}
