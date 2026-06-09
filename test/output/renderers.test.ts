import { describe, expect, it } from 'vitest';
import { renderJson } from '../../src/output/json.js';
import { renderMarkdown } from '../../src/output/markdown.js';
import { renderTerminal } from '../../src/output/terminal.js';
import type { Finding } from '../../src/engine/types.js';

const sample: Finding[] = [
  {
    severity: 'error',
    category: 'CALL_SITE_OUTDATED',
    file: 'MAIN.st',
    line: 12,
    summary: 'Call to FB_Pump.Cycle() is out of date',
    detail: 'Missing required arguments: xManualOverride',
  },
  {
    severity: 'warn',
    category: 'TIMER_VALUE_CHANGED',
    file: 'FB_Startup.st',
    line: 42,
    summary: 'Timer T_StartupDelay.PT: T#5s → T#500ms (10.0x faster)',
  },
];

describe('renderers', () => {
  it('terminal output contains all findings', () => {
    const out = renderTerminal(sample, { color: false });
    expect(out).toContain('MAIN.st');
    expect(out).toContain('FB_Startup.st');
    expect(out).toContain('CALL_SITE_OUTDATED');
    expect(out).toContain('Summary');
  });

  it('compact terminal output drops the per-finding description but keeps the finding line', () => {
    const full = renderTerminal(sample, { color: false });
    const compact = renderTerminal(sample, { color: false, compact: true });
    // The category line, file grouping, and counts survive.
    expect(compact).toContain('MAIN.st');
    expect(compact).toContain('CALL_SITE_OUTDATED (line 12)');
    expect(compact).toContain('Summary');
    // The summary and detail text are omitted.
    expect(compact).not.toContain('Call to FB_Pump.Cycle() is out of date');
    expect(compact).not.toContain('Missing required arguments');
    // One finding line per finding: no line is more indented than the
    // category line (no 4-space summary / 6-space detail lines remain).
    expect(compact.split('\n').some((l) => /^\s{4,}\S/.test(l))).toBe(false);
    // And it really is shorter than the full render.
    expect(compact.split('\n').length).toBeLessThan(full.split('\n').length);
  });

  it('markdown output is well-formed', () => {
    const out = renderMarkdown(sample);
    expect(out).toContain('| Severity | Category | Location | Summary |');
    expect(out).toContain('CALL_SITE_OUTDATED');
    expect(out).toContain('### CALL_SITE_OUTDATED');
  });

  it('json output is valid JSON with summary counts', () => {
    const out = renderJson(sample);
    const parsed = JSON.parse(out);
    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.summary).toEqual({ error: 1, warn: 1, info: 0 });
    expect(parsed.findings).toHaveLength(2);
  });
});
