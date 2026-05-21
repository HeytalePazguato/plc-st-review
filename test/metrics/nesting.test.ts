import { describe, expect, it } from 'vitest';
import { computeFileMetrics } from '../../src/engine/metrics/pou-metrics.js';
import { parseSource } from '../../src/engine/parse.js';

async function nestingOf(name: string, src: string): Promise<number> {
  const ast = await parseSource(src, `${name}.st`);
  const m = computeFileMetrics(ast).get(name);
  if (!m) throw new Error(`POU ${name} not found in parsed metrics`);
  return m.nestingDepth;
}

describe('max nesting depth', () => {
  it('is 0 for a POU with no control flow', async () => {
    const d = await nestingOf(
      'FC_Flat',
      `FUNCTION FC_Flat : INT\nFC_Flat := 1;\nEND_FUNCTION\n`,
    );
    expect(d).toBe(0);
  });

  it('is 1 for a single un-nested IF', async () => {
    const d = await nestingOf(
      'FB_One',
      `FUNCTION_BLOCK FB_One
VAR_INPUT a : BOOL; END_VAR
VAR y : INT; END_VAR
IF a THEN y := 1; END_IF;
END_FUNCTION_BLOCK
`,
    );
    expect(d).toBe(1);
  });

  it('counts IF > FOR > CASE as depth 3', async () => {
    const d = await nestingOf(
      'FB_Deep',
      `FUNCTION_BLOCK FB_Deep
VAR_INPUT a : BOOL; END_VAR
VAR i : INT; s : INT; y : INT; END_VAR
IF a THEN
  FOR i := 0 TO 10 DO
    CASE s OF
      0: y := 0;
    END_CASE;
  END_FOR;
END_IF;
END_FUNCTION_BLOCK
`,
    );
    expect(d).toBe(3);
  });

  it('does not count ELSIF clauses as extra depth', async () => {
    const d = await nestingOf(
      'FB_Elsif',
      `FUNCTION_BLOCK FB_Elsif
VAR_INPUT a : BOOL; b : BOOL; END_VAR
VAR i : INT; END_VAR
IF a THEN
  i := 1;
ELSIF b THEN
  WHILE b DO i := i + 1; END_WHILE;
END_IF;
END_FUNCTION_BLOCK
`,
    );
    // IF (1) -> WHILE inside the ELSIF branch (2)
    expect(d).toBe(2);
  });
});
