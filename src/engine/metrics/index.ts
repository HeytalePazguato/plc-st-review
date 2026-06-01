import { buildSymbolTable } from '../symbols.js';
import type { AstFile, MetricsThresholds } from '../types.js';
import { aggregateMetrics, type AggregateMetrics } from './aggregate.js';
import { buildCallGraph, type CallGraph } from './callgraph.js';
import { computeFileMetrics, type PouMetrics } from './pou-metrics.js';

export type { CallGraph } from './callgraph.js';
export type { AggregateMetrics } from './aggregate.js';
export type { PouMetrics } from './pou-metrics.js';

export type ThresholdStatus = 'ok' | 'warn' | 'error';

/** Full per-POU report: AST metrics + symbol-table counts + call-graph fans. */
export interface PouReport extends PouMetrics {
  kind: string;
  inputCount: number;
  outputCount: number;
  variableCount: number;
  methodCount: number;
  fanIn: number;
  fanOut: number;
  thresholdStatus: ThresholdStatus;
}

export interface MetricsResult {
  perPou: PouReport[];
  aggregate: AggregateMetrics;
  graph: CallGraph;
}

const TOP_LEVEL = new Set<string>(['program', 'function', 'function_block']);

/** Compute the full metrics report for a parsed project. */
export function runMetrics(
  files: AstFile[],
  thresholds: MetricsThresholds,
): MetricsResult {
  const table = buildSymbolTable(files);
  const graph = buildCallGraph(table);

  const astByName = new Map<string, PouMetrics>();
  for (const f of files) {
    for (const [name, m] of computeFileMetrics(f)) astByName.set(name, m);
  }

  const perPou: PouReport[] = [];
  for (const p of table.pous.values()) {
    if (!TOP_LEVEL.has(p.kind)) continue;
    const ast = astByName.get(p.qualifiedName);
    if (!ast) continue;
    const variableCount =
      (table.pouLocals.get(p.qualifiedName)?.length ?? 0) +
      p.inputs.length +
      p.outputs.length +
      p.inOuts.length;
    const fanIn = graph.fanIn.get(p.name) ?? 0;
    const fanOut = graph.fanOut.get(p.name) ?? 0;
    perPou.push({
      ...ast,
      kind: p.kind,
      inputCount: p.inputs.length,
      outputCount: p.outputs.length,
      variableCount,
      methodCount: countMethods(table, p.qualifiedName),
      fanIn,
      fanOut,
      thresholdStatus: statusFor(ast, fanOut, thresholds),
    });
  }
  perPou.sort((a, b) => a.name.localeCompare(b.name));

  return { perPou, aggregate: aggregateMetrics(table, graph, perPou), graph };
}

function countMethods(
  table: ReturnType<typeof buildSymbolTable>,
  ownerName: string,
): number {
  let n = 0;
  for (const p of table.pous.values()) {
    if (p.kind === 'method' && p.parent === ownerName) n += 1;
  }
  return n;
}

function statusFor(
  m: PouMetrics,
  fanOut: number,
  t: MetricsThresholds,
): ThresholdStatus {
  const bands: Array<[number, number, number]> = [
    [m.complexity, t.cyclomaticComplexity.warn, t.cyclomaticComplexity.error],
    [m.nestingDepth, t.nestingDepth.warn, t.nestingDepth.error],
    [m.loc, t.linesOfCode.warn, t.linesOfCode.error],
    [fanOut, t.fanOut.warn, t.fanOut.error],
  ];
  // Status reflects the "bigger is worse" metrics only. Comment ratio is a
  // "below" signal of a different character; folding it in would paint nearly
  // every uncommented POU yellow and drown out the real outliers.
  let status: ThresholdStatus = 'ok';
  for (const [value, warn, error] of bands) {
    if (value >= error) return 'error';
    if (value >= warn) status = 'warn';
  }
  return status;
}
