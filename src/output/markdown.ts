import { summary } from '../engine/review.js';
import type { Finding, Severity } from '../engine/types.js';

const SEV_BADGE: Record<Severity, string> = {
  error: '🟥 error',
  warn: '🟧 warn',
  info: '🟦 info',
};

export function renderMarkdown(findings: Finding[]): string {
  const out: string[] = ['# plc-st-review report', ''];
  const s = summary(findings);
  out.push(
    `**Summary:** ${s.error} error${plural(s.error)}, ${s.warn} warning${plural(s.warn)}, ${s.info} info`,
  );
  out.push('');
  if (findings.length === 0) {
    out.push('_No semantic findings._');
    return out.join('\n');
  }
  out.push('| Severity | Category | Location | Summary |');
  out.push('|---|---|---|---|');
  for (const f of findings) {
    out.push(
      `| ${SEV_BADGE[f.severity]} | \`${f.category}\` | \`${f.file}:${f.line}\` | ${escape(f.summary)} |`,
    );
  }
  out.push('');
  out.push('## Details');
  out.push('');
  for (const f of findings) {
    out.push(`### ${f.category} — \`${f.file}:${f.line}\``);
    out.push('');
    out.push(`**${SEV_BADGE[f.severity]}** — ${escape(f.summary)}`);
    if (f.detail) {
      out.push('');
      out.push('```');
      out.push(f.detail);
      out.push('```');
    }
    if (f.related && f.related.length > 0) {
      out.push('');
      out.push('Related:');
      for (const r of f.related) {
        out.push(`- \`${r.file}:${r.line}\`${r.note ? ' — ' + r.note : ''}`);
      }
    }
    out.push('');
  }
  return out.join('\n');
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}

function escape(text: string): string {
  return text.replace(/\|/g, '\\|');
}
