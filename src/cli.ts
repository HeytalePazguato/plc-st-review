#!/usr/bin/env node
import { access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { loadConfig } from './config.js';
import { runReview, shouldFail } from './engine/review.js';
import { renderJson } from './output/json.js';
import { renderMarkdown } from './output/markdown.js';
import { renderTerminal } from './output/terminal.js';
import { loadPathPair, loadRefSnapshot } from './platforms/local.js';
import {
  loadGitlabMrSnapshot,
  postGitlabReview,
  resolveGitlabOptionsFromEnv,
} from './platforms/gitlab.js';
import {
  loadGitHubPrSnapshot,
  postGitHubReview,
  resolveGitHubOptionsFromEnv,
} from './platforms/github.js';
import { SEVERITY_RANK, type Severity } from './engine/types.js';

interface CliOptions {
  base?: string;
  head?: string;
  files?: string[];
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
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name('plc-st-review')
    .description(
      'Semantic code review for IEC 61131-3 Structured Text pull requests',
    )
    .option('--base <ref>', 'git base ref (e.g. main)')
    .option('--head <ref>', 'git head ref (e.g. feature/x)', 'HEAD')
    .option('--files <before> <after>', 'review two specific files', collectFiles, [])
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
    .parse(process.argv);

  const opts = program.opts<CliOptions>();
  if (!isOutput(opts.output)) {
    fail(`Invalid --output: ${String(opts.output)}`);
  }
  if (!isSeverity(opts.severity)) {
    fail(`Invalid --severity: ${String(opts.severity)}`);
  }

  const configPath = opts.config ?? (await discoverConfig());
  if (configPath && !opts.config) {
    console.error(`plc-st-review: using config ${configPath}`);
  }
  const config = await loadConfig(configPath);

  if (opts.gitlab) {
    await runGitlabMode(opts, config);
    return;
  }
  if (opts.github) {
    await runGitHubMode(opts, config);
    return;
  }

  let snap;
  if (opts.files && opts.files.length === 2) {
    snap = await loadPathPair(opts.files[0], opts.files[1]);
  } else if (opts.base) {
    snap = await loadRefSnapshot({
      base: opts.base,
      head: opts.head ?? 'HEAD',
    });
  } else {
    fail(
      'Provide one of: --base <ref>, --files <old> <new>, --gitlab --mr <iid>, or --github --pr <number>.',
    );
  }

  const findings = runReview({
    beforeFiles: snap.before,
    afterFiles: snap.after,
    config,
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

  const { before, after, context } = await loadGitHubPrSnapshot(gh);
  const findings = runReview({
    beforeFiles: before,
    afterFiles: after,
    config,
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

  const { before, after, context } = await loadGitlabMrSnapshot(gl);
  const findings = runReview({
    beforeFiles: before,
    afterFiles: after,
    config,
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

function collectFiles(value: string, prev: string[]): string[] {
  return [...prev, value];
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
