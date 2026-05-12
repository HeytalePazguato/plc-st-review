import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import {
  ALL_CATEGORIES,
  type Category,
  type ResolvedConfig,
  type Severity,
} from './engine/types.js';

interface RawConfig {
  disabled_checks?: string[];
  severity_overrides?: Record<string, string>;
  ignore_paths?: string[];
  safety_critical_prefixes?: string[];
  reporting?: {
    fail_on_severity?: string;
    comment_style?: string;
  };
}

export const DEFAULT_CONFIG: ResolvedConfig = Object.freeze({
  disabledChecks: new Set<Category>(),
  severityOverrides: new Map<Category, Severity>(),
  ignorePaths: [],
  safetyCriticalPrefixes: ['SAFETY_', 'INTERLOCK_', 'SIL_', 'LIMIT_', 'MAX_', 'MIN_'],
  failOnSeverity: 'error' as Severity,
  commentStyle: 'inline' as ResolvedConfig['commentStyle'],
});

export async function loadConfig(path: string | null): Promise<ResolvedConfig> {
  if (!path) return cloneDefault();
  let raw: RawConfig;
  try {
    const text = await readFile(path, 'utf8');
    raw = (parseYaml(text) ?? {}) as RawConfig;
  } catch (err) {
    throw new Error(`Failed to load config at ${path}: ${(err as Error).message}`, {
      cause: err as Error,
    });
  }
  return resolveConfig(raw);
}

export function resolveConfig(raw: RawConfig): ResolvedConfig {
  const cfg = cloneDefault();
  if (raw.disabled_checks) {
    for (const c of raw.disabled_checks) {
      if (isCategory(c)) cfg.disabledChecks.add(c);
    }
  }
  if (raw.severity_overrides) {
    for (const [k, v] of Object.entries(raw.severity_overrides)) {
      if (isCategory(k) && isSeverity(v)) cfg.severityOverrides.set(k, v);
    }
  }
  if (raw.ignore_paths) cfg.ignorePaths = [...raw.ignore_paths];
  if (raw.safety_critical_prefixes)
    cfg.safetyCriticalPrefixes = [...raw.safety_critical_prefixes];
  if (raw.reporting?.fail_on_severity && isSeverity(raw.reporting.fail_on_severity))
    cfg.failOnSeverity = raw.reporting.fail_on_severity;
  if (
    raw.reporting?.comment_style === 'inline' ||
    raw.reporting?.comment_style === 'summary' ||
    raw.reporting?.comment_style === 'both'
  ) {
    cfg.commentStyle = raw.reporting.comment_style;
  }
  return cfg;
}

function cloneDefault(): ResolvedConfig {
  return {
    disabledChecks: new Set(DEFAULT_CONFIG.disabledChecks),
    severityOverrides: new Map(DEFAULT_CONFIG.severityOverrides),
    ignorePaths: [...DEFAULT_CONFIG.ignorePaths],
    safetyCriticalPrefixes: [...DEFAULT_CONFIG.safetyCriticalPrefixes],
    failOnSeverity: DEFAULT_CONFIG.failOnSeverity,
    commentStyle: DEFAULT_CONFIG.commentStyle,
  };
}

function isCategory(s: string): s is Category {
  return (ALL_CATEGORIES as readonly string[]).includes(s);
}

function isSeverity(s: string): s is Severity {
  return s === 'info' || s === 'warn' || s === 'error';
}
