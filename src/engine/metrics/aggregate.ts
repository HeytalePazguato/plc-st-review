import type { SymbolTable } from '../types.js';
import type { CallGraph } from './callgraph.js';

export interface AggregateMetrics {
  totalPous: number;
  totalLoc: number;
  totalTypes: number;
  totalGlobals: number;
  avgComplexity: number;
  avgNesting: number;
  deadPous: string[];
  orphanTypes: string[];
  dependencyDepth: number;
  cycles: string[][];
  docCoverage: number;
}

const TYPE_KINDS = new Set<string>([
  'enum_type',
  'structure_type',
  'array_type',
  'alias_type',
]);

const TOP_LEVEL_KINDS = new Set<string>(['program', 'function', 'function_block']);

/** Per-POU inputs the aggregate needs; a subset of the full per-POU report. */
export interface PouMetricSummary {
  complexity: number;
  nestingDepth: number;
  loc: number;
}

export function aggregateMetrics(
  table: SymbolTable,
  graph: CallGraph,
  perPou: readonly PouMetricSummary[],
): AggregateMetrics {
  const totalPous = perPou.length;
  const totalLoc = perPou.reduce((sum, p) => sum + p.loc, 0);
  const avgComplexity = mean(perPou.map((p) => p.complexity));
  const avgNesting = mean(perPou.map((p) => p.nestingDepth));

  const declaredTypes = table.declarations.filter((d) => TYPE_KINDS.has(d.kind));

  return {
    totalPous,
    totalLoc,
    totalTypes: declaredTypes.length,
    totalGlobals: table.globalDecls.length,
    avgComplexity,
    avgNesting,
    deadPous: graph.deadPous,
    orphanTypes: findOrphanTypes(table, declaredTypes.map((d) => d.name)),
    dependencyDepth: graph.dependencyDepth,
    cycles: graph.cycles,
    docCoverage: docCoverage(table),
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

/**
 * A declared TYPE is an orphan when its name never appears as the type of a
 * declaration (var / param / array element / extends / implements) nor as the
 * left side of a qualified member access (`E_State.IDLE`). We deliberately do
 * NOT consult `varReferences`: an enum's own declaration emits a self-reference
 * there, which would mark every declared enum as used. The trade-off is that an
 * enum used ONLY through bare, unqualified members may be reported as orphan.
 */
function findOrphanTypes(table: SymbolTable, declaredNames: string[]): string[] {
  const used = new Set<string>();
  const addTokens = (text: string | undefined): void => {
    if (!text) return;
    for (const tok of text.split(/[^A-Za-z0-9_]+/)) {
      if (tok) used.add(tok.toLowerCase());
    }
  };

  for (const p of table.pous.values()) {
    for (const param of [...p.inputs, ...p.outputs, ...p.inOuts]) addTokens(param.typeText);
    if (p.extends) used.add(p.extends.toLowerCase());
    for (const impl of p.implements) used.add(impl.toLowerCase());
  }
  for (const g of table.globalDecls) addTokens(g.typeText);
  for (const locals of table.pouLocals.values()) {
    for (const l of locals) addTokens(l.typeText);
  }
  for (const a of table.arrayDecls) addTokens(a.elementType);
  for (const m of table.memberAccesses) used.add(m.leftText.toLowerCase());

  return declaredNames.filter((name) => !used.has(name.toLowerCase())).sort();
}

/**
 * Percentage of top-level POUs that have a comment on the line directly above
 * their declaration. Comment nodes only carry a start line, so a block comment
 * is credited by its first line; "directly above" means start line == pou - 1.
 */
function docCoverage(table: SymbolTable): number {
  const commentLines = new Map<string, Set<number>>();
  for (const c of table.comments) {
    const set = commentLines.get(c.file) ?? new Set<number>();
    set.add(c.line);
    commentLines.set(c.file, set);
  }

  let total = 0;
  let documented = 0;
  for (const p of table.pous.values()) {
    if (!TOP_LEVEL_KINDS.has(p.kind)) continue;
    total += 1;
    if (commentLines.get(p.file)?.has(p.line - 1)) documented += 1;
  }
  if (total === 0) return 0;
  return Math.round((documented / total) * 1000) / 10;
}
