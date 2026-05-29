import { DEFAULT_CONFIG } from '../../src/config.js';
import { runReview } from '../../src/engine/review.js';
import type { AstFile, Finding, ResolvedConfig } from '../../src/engine/types.js';

export function review(
  before: AstFile[],
  after: AstFile[],
  configPatch: Partial<ResolvedConfig> = {},
): Finding[] {
  const config: ResolvedConfig = {
    disabledChecks: new Set(DEFAULT_CONFIG.disabledChecks),
    severityOverrides: new Map(DEFAULT_CONFIG.severityOverrides),
    ignorePaths: [...DEFAULT_CONFIG.ignorePaths],
    safetyCriticalPrefixes: [...DEFAULT_CONFIG.safetyCriticalPrefixes],
    failOnSeverity: DEFAULT_CONFIG.failOnSeverity,
    commentStyle: DEFAULT_CONFIG.commentStyle,
    forbiddenSymbols: [...DEFAULT_CONFIG.forbiddenSymbols],
    namingConventions: { ...DEFAULT_CONFIG.namingConventions },
    namingIgnore: [...DEFAULT_CONFIG.namingIgnore],
    metricsThresholds: DEFAULT_CONFIG.metricsThresholds,
    caseSensitive: DEFAULT_CONFIG.caseSensitive,
    ...configPatch,
  };
  return runReview({ beforeFiles: before, afterFiles: after, config });
}
