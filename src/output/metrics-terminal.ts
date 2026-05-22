import pc from 'picocolors';
import type { MetricsResult, PouReport, ThresholdStatus } from '../engine/metrics/index.js';
import type { MetricsThresholds } from '../engine/types.js';

const STATUS_ICON: Record<ThresholdStatus, string> = {
  ok: '🟢',
  warn: '🟡',
  error: '🔴',
};

export interface MetricsTerminalOptions {
  label: string;
  thresholds: MetricsThresholds;
  top?: number;
  /** Name of the metric `perPou` is already ordered by, for the heading. */
  sortLabel?: string;
  color?: boolean;
}

export function renderMetricsTerminal(
  result: MetricsResult,
  opts: MetricsTerminalOptions,
): string {
  const useColor = opts.color ?? isTTY();
  const top = opts.top ?? 10;
  const a = result.aggregate;
  const out: string[] = [];

  out.push(
    paint(useColor, 'bold', `Project: ${opts.label}`) +
      `  (${a.totalPous} POUs, ${fmt(a.totalLoc)} LOC)`,
  );
  out.push('');

  const shown = result.perPou.slice(0, top);
  if (shown.length > 0) {
    out.push(paint(useColor, 'bold', `Top ${shown.length} by ${opts.sortLabel ?? 'complexity'}:`));
    const width = Math.max(...shown.map((p) => p.name.length));
    for (const p of shown) out.push('  ' + pouLine(p, width));
    out.push('');
  }

  out.push(paint(useColor, 'bold', 'Dead code:'));
  if (a.deadPous.length === 0) {
    out.push('  ' + paint(useColor, 'green', 'none'));
  } else {
    for (const name of a.deadPous) out.push(`  ${name}    (0 callers)`);
  }
  out.push('');

  if (a.orphanTypes.length > 0) {
    out.push(paint(useColor, 'bold', 'Orphan types:'));
    for (const t of a.orphanTypes) out.push(`  ${t}`);
    out.push('');
  }

  if (a.cycles.length > 0) {
    out.push(paint(useColor, 'bold', 'Call cycles:'));
    for (const cycle of a.cycles) out.push(`  ${cycle.join(' <-> ')}`);
    out.push('');
  }

  out.push(paint(useColor, 'bold', 'Summary:'));
  out.push(
    `  Avg complexity: ${a.avgComplexity}  Avg nesting: ${a.avgNesting}  ` +
      `Doc coverage: ${a.docCoverage}%  Dependency depth: ${a.dependencyDepth}`,
  );
  const errors = result.perPou.filter((p) => p.complexity >= opts.thresholds.cyclomaticComplexity.error);
  const warns = result.perPou.filter(
    (p) =>
      p.complexity >= opts.thresholds.cyclomaticComplexity.warn &&
      p.complexity < opts.thresholds.cyclomaticComplexity.error,
  );
  if (errors.length > 0) {
    out.push(
      '  ' +
        paint(useColor, 'red', `${STATUS_ICON.error} ${errors.length} POUs exceed complexity threshold (${opts.thresholds.cyclomaticComplexity.error})`),
    );
  }
  if (warns.length > 0) {
    out.push(
      '  ' +
        paint(useColor, 'yellow', `${STATUS_ICON.warn} ${warns.length} POUs in complexity warning range`),
    );
  }
  if (errors.length === 0 && warns.length === 0) {
    out.push('  ' + paint(useColor, 'green', 'All POUs within complexity thresholds'));
  }

  return out.join('\n');
}

function pouLine(p: PouReport, nameWidth: number): string {
  const name = p.name.padEnd(nameWidth);
  return (
    `${name}  complexity: ${String(p.complexity).padStart(3)}  ` +
    `nesting: ${String(p.nestingDepth).padStart(2)}  ` +
    `LOC: ${String(p.loc).padStart(5)}  ${STATUS_ICON[p.thresholdStatus]}`
  );
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function paint(
  useColor: boolean,
  color: 'red' | 'yellow' | 'green' | 'bold',
  text: string,
): string {
  if (!useColor) return text;
  switch (color) {
    case 'red':
      return pc.red(text);
    case 'yellow':
      return pc.yellow(text);
    case 'green':
      return pc.green(text);
    case 'bold':
      return pc.bold(text);
  }
}

function isTTY(): boolean {
  return Boolean(process.stdout && (process.stdout as { isTTY?: boolean }).isTTY);
}
