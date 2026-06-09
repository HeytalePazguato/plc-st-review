import pc from 'picocolors';
import { summary } from '../engine/review.js';
import type { Finding, Severity } from '../engine/types.js';

const ICON: Record<Severity, string> = {
  info: 'i',
  warn: '!',
  error: 'x',
};

export interface TerminalOptions {
  color?: boolean;
  /**
   * One line per finding: severity + category + location, with the per-finding
   * description (`summary`, `detail`, and `related`) omitted. Keeps the file
   * grouping and the trailing counts. Handy for screenshots and CI logs.
   */
  compact?: boolean;
}

export function renderTerminal(
  findings: Finding[],
  opts: TerminalOptions = {},
): string {
  const useColor = opts.color ?? isTTY();
  const compact = opts.compact ?? false;
  const out: string[] = [];
  const byFile = groupBy(findings, (f) => f.file);
  const files = [...byFile.keys()].sort();
  if (files.length === 0) {
    return paint(useColor, 'green', 'No semantic findings.') + '\n' + counts(findings, useColor);
  }
  for (const f of files) {
    out.push(paint(useColor, 'bold', f));
    for (const finding of byFile.get(f)!) {
      const sev = paintSeverity(useColor, finding.severity);
      out.push(
        `  ${sev} ${ICON[finding.severity]} ${paint(useColor, 'dim', finding.category)} (line ${finding.line})`,
      );
      if (compact) continue;
      out.push(`    ${finding.summary}`);
      if (finding.detail) {
        for (const line of finding.detail.split('\n')) {
          out.push(`      ${paint(useColor, 'dim', line)}`);
        }
      }
      if (finding.related && finding.related.length > 0) {
        for (const r of finding.related) {
          out.push(
            `      ${paint(useColor, 'dim', `↳ ${r.file}:${r.line}${r.note ? ' ' + r.note : ''}`)}`,
          );
        }
      }
    }
    out.push('');
  }
  out.push(counts(findings, useColor));
  return out.join('\n');
}

function counts(findings: Finding[], useColor: boolean): string {
  const s = summary(findings);
  const parts: string[] = [];
  if (s.error)
    parts.push(paint(useColor, 'red', `${s.error} error${s.error === 1 ? '' : 's'}`));
  if (s.warn)
    parts.push(paint(useColor, 'yellow', `${s.warn} warning${s.warn === 1 ? '' : 's'}`));
  if (s.info)
    parts.push(paint(useColor, 'blue', `${s.info} info`));
  if (parts.length === 0)
    return paint(useColor, 'green', 'Summary: clean');
  return 'Summary: ' + parts.join(', ');
}

function paintSeverity(useColor: boolean, severity: Severity): string {
  if (severity === 'error') return paint(useColor, 'red', 'error');
  if (severity === 'warn') return paint(useColor, 'yellow', 'warn');
  return paint(useColor, 'blue', 'info');
}

function paint(
  useColor: boolean,
  color: 'red' | 'yellow' | 'blue' | 'green' | 'dim' | 'bold',
  text: string,
): string {
  if (!useColor) return text;
  switch (color) {
    case 'red':
      return pc.red(text);
    case 'yellow':
      return pc.yellow(text);
    case 'blue':
      return pc.blue(text);
    case 'green':
      return pc.green(text);
    case 'dim':
      return pc.dim(text);
    case 'bold':
      return pc.bold(text);
  }
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const i of items) {
    const k = key(i);
    const arr = m.get(k);
    if (arr) arr.push(i);
    else m.set(k, [i]);
  }
  return m;
}

function isTTY(): boolean {
  return Boolean(process.stdout && (process.stdout as { isTTY?: boolean }).isTTY);
}
