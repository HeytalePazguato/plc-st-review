import type { MetricsResult, PouReport, ThresholdStatus } from '../engine/metrics/index.js';

const FILL: Record<ThresholdStatus, string> = {
  ok: '#51cf66', // green
  warn: '#ffd43b', // yellow
  error: '#ff6b6b', // red
};

const DEAD_FILL = '#e9ecef'; // grey: reached by no caller
const DEAD_LINE = '#868e96'; // grey border + font for dead nodes

/**
 * Render the POU call graph as Graphviz DOT. Each node is filled by its
 * threshold status (green / yellow / red) and labelled with its headline
 * metrics; dead POUs (no callers and not reached via inheritance) are drawn
 * dashed-grey and marked so the graph shows what is abandoned, not just what is
 * complex. A legend explains the encoding. Edges are `caller -> callee`. Pipe
 * to `dot -Tpng` / `dot -Tsvg`.
 */
export function renderDot(result: MetricsResult): string {
  const reportByName = new Map<string, PouReport>();
  for (const p of result.perPou) reportByName.set(p.name, p);
  const dead = new Set(result.graph.deadPous);

  const lines: string[] = [
    'digraph plc {',
    '  rankdir=LR;',
    '  node [shape=box, style=filled, fontname="sans-serif"];',
    '',
  ];

  for (const name of [...result.graph.nodes].sort()) {
    lines.push('  ' + nodeLine(name, reportByName.get(name), dead.has(name)));
  }
  lines.push('');

  const edges: string[] = [];
  for (const [from, callees] of result.graph.adjacency) {
    for (const to of [...callees].sort()) {
      edges.push(`  ${quote(from)} -> ${quote(to)};`);
    }
  }
  edges.sort();
  lines.push(...edges);

  lines.push('');
  lines.push(...legend());

  lines.push('}');
  return lines.join('\n');
}

function nodeLine(
  name: string,
  report: PouReport | undefined,
  isDead: boolean,
): string {
  const metrics = report
    ? `cx ${report.complexity}  nest ${report.nestingDepth}  ${report.loc} LOC`
    : '';
  const label = isDead
    ? `${name}\\n${metrics}\\n(dead - no callers)`
    : `${name}\\n${metrics}`;
  const attrs = [`label="${label}"`];
  if (isDead) {
    attrs.push(
      `fillcolor="${DEAD_FILL}"`,
      'style="filled,dashed"',
      `color="${DEAD_LINE}"`,
      `fontcolor="${DEAD_LINE}"`,
    );
  } else {
    attrs.push(`fillcolor="${FILL[report?.thresholdStatus ?? 'ok']}"`);
  }
  return `${quote(name)} [${attrs.join(', ')}];`;
}

/**
 * A boxed legend mapping each fill to its meaning. The invisible chain keeps
 * the four sample nodes together and ordered instead of scattering them through
 * the real graph.
 */
function legend(): string[] {
  return [
    '  subgraph cluster_legend {',
    '    label="Legend";',
    '    fontname="sans-serif";',
    '    style=dashed;',
    '    color="#adb5bd";',
    '    node [shape=box, style=filled, fontname="sans-serif"];',
    `    "legend_ok"    [label="within thresholds", fillcolor="${FILL.ok}"];`,
    `    "legend_warn"  [label="warn band", fillcolor="${FILL.warn}"];`,
    `    "legend_error" [label="error band", fillcolor="${FILL.error}"];`,
    `    "legend_dead"  [label="dead - no callers", fillcolor="${DEAD_FILL}", style="filled,dashed", color="${DEAD_LINE}", fontcolor="${DEAD_LINE}"];`,
    '    "legend_ok" -> "legend_warn" -> "legend_error" -> "legend_dead" [style=invis];',
    '  }',
  ];
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}
