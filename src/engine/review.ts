import { allChecks } from './checks/index.js';
import { pairFiles } from './diff.js';
import { buildSymbolTable } from './symbols.js';
import {
  SEVERITY_RANK,
  type AstFile,
  type Finding,
  type ResolvedConfig,
  type ReviewContext,
} from './types.js';

export interface ReviewInput {
  beforeFiles: AstFile[];
  afterFiles: AstFile[];
  config: ResolvedConfig;
}

export function runReview(input: ReviewInput): Finding[] {
  const pairs = pairFiles(input.beforeFiles, input.afterFiles);
  const before = buildSymbolTable(input.beforeFiles);
  const after = buildSymbolTable(input.afterFiles);
  const ctx: ReviewContext = {
    config: input.config,
    pairs,
    before,
    after,
  };

  const findings: Finding[] = [];
  for (const check of allChecks()) {
    if (input.config.disabledChecks.has(check.category)) continue;
    const raw = check.run(ctx);
    for (const f of raw) {
      const overridden =
        input.config.severityOverrides.get(check.category) ?? f.severity;
      findings.push({ ...f, severity: overridden });
    }
  }
  return sortFindings(findings);
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sev !== 0) return sev;
    const file = a.file.localeCompare(b.file);
    if (file !== 0) return file;
    if (a.line !== b.line) return a.line - b.line;
    return a.category.localeCompare(b.category);
  });
}

export function summary(findings: Finding[]): {
  error: number;
  warn: number;
  info: number;
} {
  const out = { error: 0, warn: 0, info: 0 };
  for (const f of findings) out[f.severity] += 1;
  return out;
}

export function shouldFail(
  findings: Finding[],
  threshold: ResolvedConfig['failOnSeverity'],
): boolean {
  const min = SEVERITY_RANK[threshold];
  return findings.some((f) => SEVERITY_RANK[f.severity] >= min);
}
