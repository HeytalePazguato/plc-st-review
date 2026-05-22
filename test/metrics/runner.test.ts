import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config.js';
import { runMetrics } from '../../src/engine/metrics/index.js';
import { parseSource } from '../../src/engine/parse.js';

const thresholds = DEFAULT_CONFIG.metricsThresholds;

async function metricsOf(...srcs: string[]) {
  const files = await Promise.all(
    srcs.map((s, i) => parseSource(s, `f${i}.st`)),
  );
  return runMetrics(files, thresholds);
}

describe('runMetrics', () => {
  it('reports per-POU metrics with symbol-table counts and fans', async () => {
    const result = await metricsOf(
      `FUNCTION_BLOCK FB_Worker
VAR_INPUT a : BOOL; b : BOOL; END_VAR
VAR_OUTPUT done : BOOL; END_VAR
VAR i : INT; END_VAR
IF a AND b THEN
  done := TRUE;
END_IF;
END_FUNCTION_BLOCK
`,
      `PROGRAM MAIN
VAR w : FB_Worker; END_VAR
w(a := TRUE, b := TRUE);
END_PROGRAM
`,
    );
    const worker = result.perPou.find((p) => p.name === 'FB_Worker')!;
    expect(worker.inputCount).toBe(2);
    expect(worker.outputCount).toBe(1);
    expect(worker.complexity).toBe(3); // base 1 + IF + AND
    expect(worker.fanIn).toBe(1); // called by MAIN
    expect(result.perPou.find((p) => p.name === 'MAIN')!.fanOut).toBe(1);
  });

  it('rolls up project aggregates and flags orphan enums', async () => {
    const result = await metricsOf(
      `TYPE E_Used : (IDLE, RUN); END_TYPE
TYPE E_Orphan : (ON, OFF); END_TYPE
`,
      `FUNCTION_BLOCK FB_M
VAR m : E_Used; END_VAR
IF m = E_Used.RUN THEN m := E_Used.IDLE; END_IF;
END_FUNCTION_BLOCK
`,
    );
    expect(result.aggregate.totalPous).toBe(1);
    expect(result.aggregate.orphanTypes).toContain('E_Orphan');
    expect(result.aggregate.orphanTypes).not.toContain('E_Used');
  });

  it('marks a POU over the complexity error band as error status', async () => {
    const result = await metricsOf(
      `FUNCTION_BLOCK FB_Hot
VAR_INPUT x : INT; END_VAR
VAR y : INT; END_VAR
${Array.from({ length: 30 }, (_, i) => `IF x = ${i} THEN y := ${i}; END_IF;`).join('\n')}
END_FUNCTION_BLOCK
`,
    );
    const hot = result.perPou.find((p) => p.name === 'FB_Hot')!;
    expect(hot.complexity).toBeGreaterThanOrEqual(thresholds.cyclomaticComplexity.error);
    expect(hot.thresholdStatus).toBe('error');
  });
});
