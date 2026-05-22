import type { MetricsResult, ThresholdStatus } from '../engine/metrics/index.js';

const FILL: Record<ThresholdStatus, string> = {
  ok: '#51cf66', // green
  warn: '#ffd43b', // yellow
  error: '#ff6b6b', // red
};

/**
 * Render the POU call graph as Graphviz DOT. Nodes are filled by their
 * threshold status; edges are `caller -> callee`. Pipe to `dot -Tsvg`.
 */
export function renderDot(result: MetricsResult): string {
  const statusByName = new Map<string, ThresholdStatus>();
  for (const p of result.perPou) statusByName.set(p.name, p.thresholdStatus);

  const lines: string[] = [
    'digraph plc {',
    '  rankdir=LR;',
    '  node [shape=box, style=filled, fontname="sans-serif"];',
    '',
  ];

  for (const name of [...result.graph.nodes].sort()) {
    const fill = FILL[statusByName.get(name) ?? 'ok'];
    lines.push(`  ${quote(name)} [fillcolor="${fill}"];`);
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

  lines.push('}');
  return lines.join('\n');
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}
