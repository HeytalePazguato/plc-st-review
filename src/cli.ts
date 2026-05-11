#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { Command } from 'commander';
import { loadConfig } from './config.js';
import { runReview, shouldFail } from './engine/review.js';
import { renderJson } from './output/json.js';
import { renderMarkdown } from './output/markdown.js';
import { renderTerminal } from './output/terminal.js';
import { loadPathPair, loadRefSnapshot } from './platforms/local.js';
import { SEVERITY_RANK, type Severity } from './engine/types.js';

interface CliOptions {
  base?: string;
  head?: string;
  files?: string[];
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

  const config = await loadConfig(opts.config ?? null);

  let snap;
  if (opts.files && opts.files.length === 2) {
    snap = await loadPathPair(opts.files[0], opts.files[1]);
  } else if (opts.base) {
    snap = await loadRefSnapshot({
      base: opts.base,
      head: opts.head ?? 'HEAD',
    });
  } else {
    fail('Provide either --base <ref> or --files <old> <new>.');
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

function collectFiles(value: string, prev: string[]): string[] {
  return [...prev, value];
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
