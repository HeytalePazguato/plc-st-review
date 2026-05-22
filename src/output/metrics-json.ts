import type { MetricsResult } from '../engine/metrics/index.js';

/**
 * Machine-readable metrics report. Keys are snake_case to match the documented
 * schema for external consumers (dashboards, CI gates).
 */
export function renderMetricsJson(result: MetricsResult): string {
  const { aggregate: a } = result;
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: {
      total_pous: a.totalPous,
      total_loc: a.totalLoc,
      total_types: a.totalTypes,
      total_globals: a.totalGlobals,
      avg_complexity: a.avgComplexity,
      avg_nesting: a.avgNesting,
      dead_pous: a.deadPous,
      orphan_types: a.orphanTypes,
      dependency_depth: a.dependencyDepth,
      cycles: a.cycles,
      doc_coverage: a.docCoverage,
    },
    pous: result.perPou.map((p) => ({
      name: p.name,
      type: p.kind,
      file: p.file,
      cyclomatic_complexity: p.complexity,
      nesting_depth: p.nestingDepth,
      lines_of_code: p.loc,
      lines_total: p.locTotal,
      comment_ratio: round1(p.commentRatio),
      variable_count: p.variableCount,
      input_count: p.inputCount,
      output_count: p.outputCount,
      method_count: p.methodCount,
      statement_count: p.statementCount,
      branch_count: p.branchCount,
      return_count: p.returnCount,
      fan_in: p.fanIn,
      fan_out: p.fanOut,
      threshold_status: p.thresholdStatus,
    })),
  };
  return JSON.stringify(report, null, 2);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
