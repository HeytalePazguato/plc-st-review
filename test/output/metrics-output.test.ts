import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config.js';
import { runMetrics } from '../../src/engine/metrics/index.js';
import { parseSource } from '../../src/engine/parse.js';
import { renderBadge } from '../../src/output/badge.js';
import { renderDot } from '../../src/output/dot.js';
import { renderMetricsJson } from '../../src/output/metrics-json.js';

const thresholds = DEFAULT_CONFIG.metricsThresholds;

async function result() {
  const files = await Promise.all([
    parseSource(
      `FUNCTION_BLOCK FB_A
VAR b : FB_B; END_VAR
b();
END_FUNCTION_BLOCK
`,
      'a.st',
    ),
    parseSource(
      `FUNCTION_BLOCK FB_B
VAR i : INT; END_VAR
i := 1;
END_FUNCTION_BLOCK
`,
      'b.st',
    ),
  ]);
  return runMetrics(files, thresholds);
}

describe('metrics renderers', () => {
  it('emits a valid-looking DOT graph with one edge', async () => {
    const dot = renderDot(await result());
    expect(dot).toContain('digraph plc {');
    expect(dot).toContain('"FB_A" -> "FB_B";');
    expect(dot.trimEnd().endsWith('}')).toBe(true);
  });

  it('emits a shields.io badge URL for average complexity', async () => {
    const badge = renderBadge(await result(), thresholds);
    expect(badge).toMatch(
      /^https:\/\/img\.shields\.io\/badge\/avg%20complexity-[\d.]+-(brightgreen|yellow|red)$/,
    );
  });

  it('emits JSON with project and per-POU sections in the documented shape', async () => {
    const json = JSON.parse(renderMetricsJson(await result()));
    expect(json.project.total_pous).toBe(2);
    expect(Array.isArray(json.pous)).toBe(true);
    const a = json.pous.find((p: { name: string }) => p.name === 'FB_A');
    expect(a).toMatchObject({ type: 'function_block', fan_out: 1 });
    expect(a).toHaveProperty('cyclomatic_complexity');
    expect(a).toHaveProperty('threshold_status');
  });
});
