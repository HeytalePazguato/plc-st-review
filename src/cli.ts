#!/usr/bin/env node
import { access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { loadConfig, loadConfigFromBaseRef } from './config.js';
import { runReview, shouldFail } from './engine/review.js';
import { runMetrics, type PouReport } from './engine/metrics/index.js';
import { renderJson } from './output/json.js';
import { renderMarkdown } from './output/markdown.js';
import { renderTerminal } from './output/terminal.js';
import { renderMetricsTerminal } from './output/metrics-terminal.js';
import { renderMetricsJson } from './output/metrics-json.js';
import { renderDot } from './output/dot.js';
import { renderBadge } from './output/badge.js';
import { loadLintSnapshot, loadPathPair, loadRefSnapshot } from './platforms/local.js';
import {
  createGitbeakerClient,
  loadGitlabMrSnapshot,
  postGitlabReview,
  resolveGitlabOptionsFromEnv,
} from './platforms/gitlab.js';
import {
  createOctokitClient,
  loadGitHubPrSnapshot,
  postGitHubReview,
  resolveGitHubOptionsFromEnv,
} from './platforms/github.js';
import { projectScopedCategories } from './engine/checks/index.js';
import {
  DIFF_ONLY_CATEGORIES,
  SEVERITY_RANK,
  type AstFile,
  type ResolvedConfig,
  type Severity,
} from './engine/types.js';

interface CliOptions {
  base?: string;
  head?: string;
  files?: string[];
  lint?: string[];
  gitlab?: boolean;
  mr?: string;
  project?: string;
  gitlabUrl?: string;
  github?: boolean;
  pr?: string;
  repo?: string;
  output: 'json' | 'markdown' | 'terminal';
  severity: Severity;
  config?: string;
  outFile?: string;
  noColor?: boolean;
  metrics?: string[];
  sort?: string;
  top?: string;
  threshold?: string[];
  format: 'terminal' | 'json' | 'dot' | 'badge';
  dependencyGraph?: boolean;
  projectScope?: string | boolean;
}

type MetricKey = 'complexity' | 'nesting' | 'loc' | 'fan_in' | 'fan_out';

const METRIC_ACCESSOR: Record<MetricKey, (p: PouReport) => number> = {
  complexity: (p) => p.complexity,
  nesting: (p) => p.nestingDepth,
  loc: (p) => p.loc,
  fan_in: (p) => p.fanIn,
  fan_out: (p) => p.fanOut,
};

// Sort aliases accepted by --sort, mapped to the canonical metric key.
const SORT_ALIASES: Record<string, MetricKey> = {
  complexity: 'complexity',
  nesting: 'nesting',
  nesting_depth: 'nesting',
  loc: 'loc',
  lines_of_code: 'loc',
  fan_in: 'fan_in',
  fan_out: 'fan_out',
};

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('plc-st-review')
    .description(
      'Semantic code review for IEC 61131-3 Structured Text pull requests',
    )
    .option('--base <ref>', 'git base ref (e.g. main)')
    .option('--head <ref>', 'git head ref (e.g. feature/x)', 'HEAD')
    .option('--files <paths...>', 'review two specific files: --files <before> <after>')
    .option(
      '--lint <patterns...>',
      'static-lint mode: parse the given files / globs (e.g. `src/**/*.st`) ' +
        'and run single-revision checks only (no PR or base ref needed)',
    )
    .option('--gitlab', 'review a GitLab merge request (requires --mr)')
    .option('--mr <iid>', 'GitLab MR IID to review')
    .option('--project <id>', 'GitLab project ID or path (overrides env)')
    .option('--gitlab-url <url>', 'GitLab base URL (overrides env)')
    .option('--github', 'review a GitHub pull request (requires --pr)')
    .option('--pr <number>', 'GitHub PR number to review')
    .option('--repo <owner/name>', 'GitHub repo in owner/name form (overrides env)')
    .option('--output <fmt>', 'terminal|markdown|json', 'terminal')
    .option('--severity <level>', 'minimum severity to print', 'info')
    .option('--config <path>', 'path to .plc-st-review.yml')
    .option('--out-file <path>', 'write output to file instead of stdout')
    .option('--no-color', 'disable ANSI color')
    .option(
      '--metrics <patterns...>',
      'metrics mode: compute complexity / nesting / LOC / call-graph metrics ' +
        'for the given files / globs (e.g. `src/**/*.st`). Does not run review checks.',
    )
    .option('--sort <metric>', 'metrics: sort POUs by complexity|nesting|loc|fan_in|fan_out', 'complexity')
    .option('--top <n>', 'metrics: show only the worst N POUs')
    .option('--threshold <metric=value...>', 'metrics: exit nonzero if any POU exceeds (e.g. complexity=20)', collectThreshold, [])
    .option('--format <fmt>', 'metrics: terminal|json|dot|badge', 'terminal')
    .option('--dependency-graph', 'metrics: emit the call graph (use with --format dot)')
    .option(
      '--project-scope [glob]',
      'review: also parse the whole repo (default `**/*.st`) so project-scoped ' +
        'checks like DEAD_POU_INTRODUCED can see callers outside the diff',
    )
    .parse(process.argv);

  const opts = program.opts<CliOptions>();
  if (!isOutput(opts.output)) {
    fail(`Invalid --output: ${String(opts.output)}`);
  }
  if (!isSeverity(opts.severity)) {
    fail(`Invalid --severity: ${String(opts.severity)}`);
  }

  // In PR / MR modes, do NOT auto-discover a config in the working directory:
  // in CI the cwd is the checked-out PR head, which on a fork PR is attacker-
  // controlled (a malicious `extends:` could otherwise trigger an arbitrary
  // local file read). The mode handler will fetch the config from the base
  // commit via the platform API instead. An explicit `--config <path>` always
  // wins, including in PR modes (that's the maintainer escape hatch).
  const skipCwdDiscovery = (opts.github || opts.gitlab) && !opts.config;
  const configPath = skipCwdDiscovery
    ? null
    : (opts.config ?? (await discoverConfig()));
  if (configPath && !opts.config) {
    console.error(`plc-st-review: using config ${configPath}`);
  }
  const config = await loadConfig(configPath);

  if (opts.metrics && opts.metrics.length > 0) {
    await runMetricsMode(opts, config);
    return;
  }
  if (opts.gitlab) {
    await runGitlabMode(opts, config);
    return;
  }
  if (opts.github) {
    await runGitHubMode(opts, config);
    return;
  }

  let snap;
  let effectiveConfig = config;
  if (opts.lint && opts.lint.length > 0) {
    snap = await loadLintSnapshot(opts.lint);
    if (snap.after.length === 0) {
      fail(`--lint matched no .st files. Patterns: ${opts.lint.join(', ')}`);
    }
    // Diff-only categories would either silently produce zero findings
    // or, in two cases, surface every pragma / every variable as "new".
    // Disable them so lint output is clean.
    effectiveConfig = {
      ...config,
      disabledChecks: new Set([
        ...config.disabledChecks,
        ...DIFF_ONLY_CATEGORIES,
      ]),
    };
  } else if (opts.files && opts.files.length > 0) {
    if (opts.files.length !== 2) {
      fail(`--files needs exactly two paths: <before> <after> (got ${opts.files.length})`);
    }
    snap = await loadPathPair(opts.files[0], opts.files[1]);
  } else if (opts.base) {
    snap = await loadRefSnapshot({
      base: opts.base,
      head: opts.head ?? 'HEAD',
    });
  } else {
    fail(
      'Provide one of: --lint <patterns…>, --base <ref>, --files <old> <new>, --gitlab --mr <iid>, or --github --pr <number>.',
    );
  }

  const isLint = Boolean(opts.lint && opts.lint.length > 0);
  if (!isLint) maybeHintProjectScope(opts, effectiveConfig);
  const projectFiles = isLint ? undefined : await loadProjectScope(opts);
  const findings = runReview({
    beforeFiles: snap.before,
    afterFiles: snap.after,
    config: effectiveConfig,
    projectFiles,
  }).filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[opts.severity]);

  let rendered: string;
  if (opts.output === 'json') rendered = renderJson(findings);
  else if (opts.output === 'markdown') rendered = renderMarkdown(findings);
  else rendered = renderTerminal(findings, { color: !opts.noColor });

  if (opts.outFile) {
    await writeFile(opts.outFile, rendered + (rendered.endsWith('\n') ? '' : '\n'), 'utf8');
  } else {
    process.stdout.write(rendered + '\n');
  }

  if (shouldFail(findings, config.failOnSeverity)) {
    process.exitCode = 1;
  }
}

async function runGitHubMode(
  opts: CliOptions,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<void> {
  if (!opts.pr) fail('--github requires --pr <number>');
  const pullNumber = Number.parseInt(opts.pr, 10);
  if (!Number.isFinite(pullNumber)) fail(`Invalid --pr: ${String(opts.pr)}`);

  let owner: string | undefined;
  let repo: string | undefined;
  if (opts.repo) {
    const parts = opts.repo.split('/');
    if (parts.length !== 2) fail(`Invalid --repo: ${String(opts.repo)} (expected owner/name)`);
    owner = parts[0];
    repo = parts[1];
  }
  const gh = resolveGitHubOptionsFromEnv({ pullNumber, owner, repo });

  const api = createOctokitClient(gh);
  const { before, after, context } = await loadGitHubPrSnapshot(gh, api);

  // SECURITY: in CI the working directory holds the PR head, which on a fork
  // PR is attacker-controlled. Load the review config from the BASE commit so
  // a malicious `.plc-st-review.yml` shipped in the PR can't influence this
  // run. An explicit `--config` override still wins.
  if (!opts.config) {
    const baseConfig = await loadConfigFromBaseRef((name) =>
      api.fetchFile(context.baseSha, name),
    );
    if (baseConfig) {
      config = baseConfig;
      console.error(
        `plc-st-review: loaded config from base ref (${context.baseSha.slice(0, 8)})`,
      );
    }
  }

  maybeHintProjectScope(opts, config);
  const findings = runReview({
    beforeFiles: before,
    afterFiles: after,
    config,
    projectFiles: await loadProjectScope(opts),
  }).filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[opts.severity]);

  const result = await postGitHubReview(findings, context, {
    ...gh,
    commentStyle: config.commentStyle,
  });

  const summary = `plc-st-review (github): ${result.mode}, ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`;
  process.stdout.write(summary + '\n');

  if (opts.outFile) {
    await writeFile(opts.outFile, renderJson(findings) + '\n', 'utf8');
  }

  if (shouldFail(findings, config.failOnSeverity)) {
    process.exitCode = 1;
  }
}

async function runGitlabMode(
  opts: CliOptions,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<void> {
  if (!opts.mr) fail('--gitlab requires --mr <iid>');
  const mrIid = Number.parseInt(opts.mr, 10);
  if (!Number.isFinite(mrIid)) fail(`Invalid --mr: ${String(opts.mr)}`);

  const gl = resolveGitlabOptionsFromEnv({
    mrIid,
    projectId: opts.project,
    host: opts.gitlabUrl,
  });

  const api = createGitbeakerClient(gl);
  const { before, after, context } = await loadGitlabMrSnapshot(gl, api);

  // SECURITY: same reasoning as the GitHub path — load config from the BASE
  // commit so a malicious `.plc-st-review.yml` in the MR head can't influence
  // the review. `--config` still wins when explicitly given.
  if (!opts.config) {
    const baseConfig = await loadConfigFromBaseRef((name) =>
      api.fetchFile(gl.projectId, context.baseSha, name),
    );
    if (baseConfig) {
      config = baseConfig;
      console.error(
        `plc-st-review: loaded config from base ref (${context.baseSha.slice(0, 8)})`,
      );
    }
  }

  maybeHintProjectScope(opts, config);
  const findings = runReview({
    beforeFiles: before,
    afterFiles: after,
    config,
    projectFiles: await loadProjectScope(opts),
  }).filter((f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK[opts.severity]);

  const result = await postGitlabReview(findings, context, {
    ...gl,
    commentStyle: config.commentStyle,
  });

  const summary = `plc-st-review (gitlab): ${result.mode}, ${result.created} created, ${result.updated} updated, ${result.resolved} resolved`;
  process.stdout.write(summary + '\n');

  if (opts.outFile) {
    await writeFile(opts.outFile, renderJson(findings) + '\n', 'utf8');
  }

  if (shouldFail(findings, config.failOnSeverity)) {
    process.exitCode = 1;
  }
}

async function runMetricsMode(
  opts: CliOptions,
  config: Awaited<ReturnType<typeof loadConfig>>,
): Promise<void> {
  const { after: files } = await loadLintSnapshot(opts.metrics!);
  if (files.length === 0) {
    fail(`--metrics matched no .st files. Patterns: ${opts.metrics!.join(', ')}`);
  }

  const result = runMetrics(files, config.metricsThresholds);

  // Order POUs by the requested metric (descending), worst first.
  const sortKey = SORT_ALIASES[opts.sort ?? 'complexity'];
  if (!sortKey) fail(`Invalid --sort: ${String(opts.sort)} (complexity|nesting|loc|fan_in|fan_out)`);
  const accessor = METRIC_ACCESSOR[sortKey];
  result.perPou.sort((a, b) => accessor(b) - accessor(a) || a.name.localeCompare(b.name));

  const top = opts.top ? Number.parseInt(opts.top, 10) : undefined;
  if (opts.top && (top === undefined || !Number.isFinite(top) || top < 1)) {
    fail(`Invalid --top: ${String(opts.top)}`);
  }

  const format = opts.format;
  if (!isMetricsFormat(format)) fail(`Invalid --format: ${String(format)} (terminal|json|dot|badge)`);

  let rendered: string;
  if (format === 'json') {
    rendered = renderMetricsJson(result);
  } else if (format === 'dot') {
    rendered = renderDot(result);
  } else if (format === 'badge') {
    rendered = renderBadge(result, config.metricsThresholds);
  } else {
    rendered = renderMetricsTerminal(result, {
      label: opts.metrics!.join(' '),
      thresholds: config.metricsThresholds,
      top,
      sortLabel: sortKey,
      color: !opts.noColor,
    });
  }

  if (opts.outFile) {
    await writeFile(opts.outFile, rendered + (rendered.endsWith('\n') ? '' : '\n'), 'utf8');
  } else {
    process.stdout.write(rendered + '\n');
  }

  const breached = checkThresholds(result.perPou, opts.threshold ?? []);
  if (breached.length > 0) {
    for (const b of breached) process.stderr.write(`plc-st-review: ${b}\n`);
    process.exitCode = 1;
  }
}

/**
 * Parse `--threshold metric=value` entries and return a message per breach.
 * A breach is any POU whose metric strictly exceeds the given value.
 */
function checkThresholds(pous: PouReport[], specs: string[]): string[] {
  const breaches: string[] = [];
  for (const spec of specs) {
    const [rawKey, rawVal] = spec.split('=');
    const key = SORT_ALIASES[rawKey?.trim() ?? ''];
    const limit = Number.parseInt(rawVal ?? '', 10);
    if (!key || !Number.isFinite(limit)) {
      breaches.push(`invalid --threshold "${spec}" (expected e.g. complexity=20)`);
      continue;
    }
    const accessor = METRIC_ACCESSOR[key];
    const over = pous.filter((p) => accessor(p) > limit);
    for (const p of over) {
      breaches.push(`${p.name} ${key}=${accessor(p)} exceeds threshold ${limit}`);
    }
  }
  return breaches;
}

function collectThreshold(value: string, prev: string[]): string[] {
  return [...prev, value];
}

function isMetricsFormat(s: string): s is CliOptions['format'] {
  return s === 'terminal' || s === 'json' || s === 'dot' || s === 'badge';
}

/**
 * When `--project-scope` is set, parse the whole repo from disk (the head
 * checkout) so project-scoped checks can see callers the diff doesn't include.
 * The optional value overrides the default glob.
 */
async function loadProjectScope(opts: CliOptions): Promise<AstFile[] | undefined> {
  if (!opts.projectScope) return undefined;
  const glob = typeof opts.projectScope === 'string' ? opts.projectScope : '**/*.st';
  const { after } = await loadLintSnapshot([glob]);
  return after;
}

/**
 * If project-scoped checks are enabled but `--project-scope` wasn't passed,
 * print a one-line note to stderr so the user knows they were skipped (rather
 * than silently producing nothing).
 */
function maybeHintProjectScope(opts: CliOptions, config: ResolvedConfig): void {
  if (opts.projectScope) return;
  const skipped = projectScopedCategories().filter(
    (c) => !config.disabledChecks.has(c),
  );
  if (skipped.length === 0) return;
  process.stderr.write(
    `plc-st-review: ${skipped.join(', ')} need --project-scope (whole-repo parse); skipped\n`,
  );
}

// Look for a config file in CWD when --config is not provided. The two
// filenames cover both the common dotfile name and the editor-friendly
// non-dotfile variant. Returns the resolved absolute path, or null if
// neither exists.
async function discoverConfig(): Promise<string | null> {
  for (const name of ['.plc-st-review.yml', 'plc-st-review.yml']) {
    const candidate = resolve(process.cwd(), name);
    try {
      await access(candidate);
      return candidate;
    } catch {
      // not present, try next
    }
  }
  return null;
}

function isOutput(s: string): s is CliOptions['output'] {
  return s === 'json' || s === 'markdown' || s === 'terminal';
}

function isSeverity(s: string): s is Severity {
  return s === 'info' || s === 'warn' || s === 'error';
}

function fail(msg: string): never {
  process.stderr.write(`plc-st-review: ${msg}\n`);
  process.exit(2);
}

main().catch((err: Error) => {
  process.stderr.write(`plc-st-review: ${err.message}\n`);
  if (process.env.PLC_ST_REVIEW_DEBUG) {
    process.stderr.write((err.stack ?? '') + '\n');
  }
  process.exit(2);
});
