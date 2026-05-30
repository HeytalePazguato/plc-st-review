import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  ALL_CATEGORIES,
  type Category,
  type MetricsThresholds,
  type NamingDimension,
  type NamingRule,
  type ResolvedConfig,
  type Severity,
} from './engine/types.js';

interface RawNamingRule {
  prefix?: string;
  suffix?: string;
  pattern?: string;
  case?: 'sensitive' | 'insensitive';
  severity?: string;
}

interface RawMetricThreshold {
  warn?: number;
  error?: number;
  warn_below?: number;
}

interface RawConfig {
  extends?: string | string[];
  case_sensitive?: boolean;
  disabled_checks?: string[];
  severity_overrides?: Record<string, string>;
  ignore_paths?: string[];
  safety_critical_prefixes?: string[];
  forbidden_symbols?: string[];
  naming_conventions?: Record<string, RawNamingRule>;
  naming_ignore?: string[];
  reporting?: {
    fail_on_severity?: string;
    comment_style?: string;
  };
  metrics?: {
    thresholds?: Record<string, RawMetricThreshold>;
  };
}

const NAMING_DIMENSIONS: NamingDimension[] = [
  'bool', 'int', 'real', 'string', 'time',
  'pointer', 'reference', 'array',
  'enum_type', 'structure_type',
  'function_block', 'function', 'program', 'method', 'interface',
  'fb_instance',
  'global_var', 'input_var', 'output_var', 'in_out_var',
  'constant',
];

export const DEFAULT_METRICS_THRESHOLDS: MetricsThresholds = Object.freeze({
  cyclomaticComplexity: { warn: 15, error: 25 },
  nestingDepth: { warn: 5, error: 8 },
  linesOfCode: { warn: 300, error: 600 },
  commentRatio: { warnBelow: 10 },
  fanOut: { warn: 15, error: 25 },
});

export const DEFAULT_CONFIG: ResolvedConfig = Object.freeze({
  disabledChecks: new Set<Category>(),
  severityOverrides: new Map<Category, Severity>(),
  ignorePaths: [],
  safetyCriticalPrefixes: ['SAFETY_', 'INTERLOCK_', 'SIL_', 'LIMIT_', 'MAX_', 'MIN_'],
  failOnSeverity: 'error' as Severity,
  commentStyle: 'inline' as ResolvedConfig['commentStyle'],
  forbiddenSymbols: [],
  namingConventions: {},
  namingIgnore: [],
  metricsThresholds: cloneMetricsThresholds(DEFAULT_METRICS_THRESHOLDS),
  caseSensitive: false,
});

function cloneMetricsThresholds(m: MetricsThresholds): MetricsThresholds {
  return {
    cyclomaticComplexity: { ...m.cyclomaticComplexity },
    nestingDepth: { ...m.nestingDepth },
    linesOfCode: { ...m.linesOfCode },
    commentRatio: { ...m.commentRatio },
    fanOut: { ...m.fanOut },
  };
}

/**
 * Load a config from disk. Resolves `extends:` paths relative to each file's
 * own directory; later entries (and the local config) override earlier ones.
 */
export async function loadConfig(path: string | null): Promise<ResolvedConfig> {
  if (!path) return cloneDefault();
  const merged = await loadRawWithExtends(resolve(path), new Set());
  return resolveConfig(merged);
}

async function loadRawWithExtends(
  absPath: string,
  seen: Set<string>,
): Promise<RawConfig> {
  if (seen.has(absPath)) {
    throw new Error(`Config cycle detected at ${absPath}`);
  }
  seen.add(absPath);
  let raw: RawConfig;
  try {
    const text = await readFile(absPath, 'utf8');
    raw = (parseYaml(text) ?? {}) as RawConfig;
  } catch (err) {
    throw new Error(`Failed to load config at ${absPath}: ${(err as Error).message}`, {
      cause: err as Error,
    });
  }
  // Resolve extends relative to this file's directory.
  const dir = dirname(absPath);
  const ext = raw.extends;
  const extPaths = Array.isArray(ext) ? ext : ext ? [ext] : [];
  let merged: RawConfig = {};
  for (const p of extPaths) {
    const child = await loadRawWithExtends(
      isAbsolute(p) ? p : resolve(dir, p),
      new Set(seen),
    );
    merged = mergeRawConfigs(merged, child);
  }
  // Local config overrides everything its presets set.
  merged = mergeRawConfigs(merged, raw);
  // Remove the meta key from the result.
  delete merged.extends;
  return merged;
}

function mergeRawConfigs(base: RawConfig, override: RawConfig): RawConfig {
  return {
    extends: override.extends ?? base.extends,
    case_sensitive: override.case_sensitive ?? base.case_sensitive,
    disabled_checks: union(base.disabled_checks, override.disabled_checks),
    severity_overrides: { ...base.severity_overrides, ...override.severity_overrides },
    ignore_paths: union(base.ignore_paths, override.ignore_paths),
    safety_critical_prefixes:
      override.safety_critical_prefixes ?? base.safety_critical_prefixes,
    forbidden_symbols: union(base.forbidden_symbols, override.forbidden_symbols),
    naming_conventions: { ...base.naming_conventions, ...override.naming_conventions },
    naming_ignore: union(base.naming_ignore, override.naming_ignore),
    reporting: { ...base.reporting, ...override.reporting },
    metrics: {
      thresholds: {
        ...base.metrics?.thresholds,
        ...override.metrics?.thresholds,
      },
    },
  };
}

function union(a: string[] | undefined, b: string[] | undefined): string[] {
  const set = new Set<string>([...(a ?? []), ...(b ?? [])]);
  return [...set];
}

export function resolveConfig(raw: RawConfig): ResolvedConfig {
  const cfg = cloneDefault();
  if (typeof raw.case_sensitive === 'boolean') cfg.caseSensitive = raw.case_sensitive;
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
  if (raw.forbidden_symbols) cfg.forbiddenSymbols = [...raw.forbidden_symbols];
  if (raw.naming_ignore) cfg.namingIgnore = [...raw.naming_ignore];
  applyMetricThresholds(cfg.metricsThresholds, raw.metrics?.thresholds);
  if (raw.naming_conventions) {
    for (const [k, v] of Object.entries(raw.naming_conventions)) {
      if (!isNamingDimension(k) || !v) continue;
      const rule: NamingRule = {};
      if (typeof v.prefix === 'string') rule.prefix = v.prefix;
      if (typeof v.suffix === 'string') rule.suffix = v.suffix;
      if (typeof v.pattern === 'string') rule.pattern = v.pattern;
      if (v.case === 'insensitive' || v.case === 'sensitive') rule.case = v.case;
      if (v.severity && isSeverity(v.severity)) rule.severity = v.severity;
      cfg.namingConventions[k] = rule;
    }
  }
  return cfg;
}

/**
 * Parse a YAML config string and resolve it. Used when the config is fetched
 * from a remote ref (e.g. a PR's base commit) rather than read off disk.
 * `extends:` chains are not followed here — the caller is responsible for
 * supplying a self-contained config or fetching the chain itself.
 */
export function loadConfigFromText(text: string): ResolvedConfig {
  const raw = (parseYaml(text) ?? {}) as RawConfig;
  return resolveConfig(raw);
}

/**
 * Try to fetch `.plc-st-review.yml` / `plc-st-review.yml` via the supplied
 * `fetcher` (typically a platform `fetchFile` bound to a base commit SHA),
 * and resolve it. Returns `null` when neither name exists at that ref, so
 * the caller can fall back to the cwd default or the supplied defaults.
 *
 * This is the security-relevant config path for PR / MR review: the working
 * directory in CI contains the PR-head code, which on a fork PR is attacker-
 * controlled. Loading from the base commit means a malicious
 * `.plc-st-review.yml` shipped inside the PR can't influence the review run.
 */
export async function loadConfigFromBaseRef(
  fetcher: (name: string) => Promise<string | null>,
): Promise<ResolvedConfig | null> {
  for (const name of ['.plc-st-review.yml', 'plc-st-review.yml']) {
    const text = await fetcher(name);
    if (text !== null) return loadConfigFromText(text);
  }
  return null;
}

function cloneDefault(): ResolvedConfig {
  return {
    disabledChecks: new Set(DEFAULT_CONFIG.disabledChecks),
    severityOverrides: new Map(DEFAULT_CONFIG.severityOverrides),
    ignorePaths: [...DEFAULT_CONFIG.ignorePaths],
    safetyCriticalPrefixes: [...DEFAULT_CONFIG.safetyCriticalPrefixes],
    failOnSeverity: DEFAULT_CONFIG.failOnSeverity,
    commentStyle: DEFAULT_CONFIG.commentStyle,
    forbiddenSymbols: [...DEFAULT_CONFIG.forbiddenSymbols],
    namingConventions: { ...DEFAULT_CONFIG.namingConventions },
    namingIgnore: [...DEFAULT_CONFIG.namingIgnore],
    metricsThresholds: cloneMetricsThresholds(DEFAULT_CONFIG.metricsThresholds),
    caseSensitive: DEFAULT_CONFIG.caseSensitive,
  };
}

/**
 * Map the snake_case YAML threshold keys onto the resolved structure,
 * mutating `target` in place. Unknown metric keys are ignored; within a
 * known metric, only the bands present in the YAML are overridden.
 */
function applyMetricThresholds(
  target: MetricsThresholds,
  raw: Record<string, RawMetricThreshold> | undefined,
): void {
  if (!raw) return;
  const range = (band: { warn: number; error: number }, r: RawMetricThreshold) => {
    if (typeof r.warn === 'number') band.warn = r.warn;
    if (typeof r.error === 'number') band.error = r.error;
  };
  if (raw.cyclomatic_complexity) range(target.cyclomaticComplexity, raw.cyclomatic_complexity);
  if (raw.nesting_depth) range(target.nestingDepth, raw.nesting_depth);
  if (raw.lines_of_code) range(target.linesOfCode, raw.lines_of_code);
  if (raw.fan_out) range(target.fanOut, raw.fan_out);
  if (raw.comment_ratio && typeof raw.comment_ratio.warn_below === 'number') {
    target.commentRatio.warnBelow = raw.comment_ratio.warn_below;
  }
}

function isCategory(s: string): s is Category {
  return (ALL_CATEGORIES as readonly string[]).includes(s);
}

function isSeverity(s: string): s is Severity {
  return s === 'info' || s === 'warn' || s === 'error';
}

function isNamingDimension(s: string): s is NamingDimension {
  return (NAMING_DIMENSIONS as readonly string[]).includes(s);
}
