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
