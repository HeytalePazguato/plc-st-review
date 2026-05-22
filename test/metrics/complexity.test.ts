import { describe, expect, it } from 'vitest';
import { computeFileMetrics } from '../../src/engine/metrics/pou-metrics.js';
import { parseSource } from '../../src/engine/parse.js';

async function complexityOf(name: string, src: string): Promise<number> {
  const ast = await parseSource(src, `${name}.st`);
  const m = computeFileMetrics(ast).get(name);
  if (!m) throw new Error(`POU ${name} not found in parsed metrics`);
  return m.complexity;
}

describe('cyclomatic complexity', () => {
  it('is 1 for a POU with no control flow', async () => {
    const c = await complexityOf(
      'FC_Simple',
      `FUNCTION FC_Simple : INT\nFC_Simple := 1 + 2;\nEND_FUNCTION\n`,
    );
    expect(c).toBe(1);
  });

  it('adds 1 per IF and per ELSIF, but not for ELSE', async () => {
    const c = await complexityOf(
      'FB_Branch',
      `FUNCTION_BLOCK FB_Branch
VAR_INPUT x : INT; END_VAR
VAR y : INT; END_VAR
IF x = 0 THEN y := 0;
ELSIF x = 1 THEN y := 1;
ELSIF x = 2 THEN y := 2;
ELSIF x = 3 THEN y := 3;
ELSIF x = 4 THEN y := 4;
ELSE y := 9;
END_IF;
END_FUNCTION_BLOCK
`,
    );
    // base 1 + IF 1 + 4 ELSIF = 6
    expect(c).toBe(6);
  });

  it('adds 1 per AND/OR operator in a condition', async () => {
    const c = await complexityOf(
      'FB_Bool',
      `FUNCTION_BLOCK FB_Bool
VAR_INPUT a : BOOL; b : BOOL; c : BOOL; END_VAR
VAR y : BOOL; END_VAR
IF a AND b OR c THEN y := TRUE; END_IF;
END_FUNCTION_BLOCK
`,
    );
    // base 1 + IF 1 + AND 1 + OR 1 = 4
    expect(c).toBe(4);
  });

  it('adds 1 per CASE arm but not the CASE itself or its ELSE', async () => {
    const c = await complexityOf(
      'FB_Case',
      `FUNCTION_BLOCK FB_Case
VAR_INPUT s : INT; END_VAR
VAR y : INT; END_VAR
CASE s OF
  0: y := 0;
  1, 2: y := 1;
  3: y := 3;
ELSE
  y := 9;
END_CASE;
END_FUNCTION_BLOCK
`,
    );
    // base 1 + 3 case arms = 4
    expect(c).toBe(4);
  });

  it('adds 1 per loop (FOR, WHILE, REPEAT)', async () => {
    const c = await complexityOf(
      'FB_Loops',
      `FUNCTION_BLOCK FB_Loops
VAR i : INT; n : INT; END_VAR
FOR i := 0 TO 10 DO n := n + 1; END_FOR;
WHILE n > 0 DO n := n - 1; END_WHILE;
REPEAT n := n + 1; UNTIL n >= 10 END_REPEAT;
END_FUNCTION_BLOCK
`,
    );
    // base 1 + FOR + WHILE + REPEAT = 4 (n > 0 / n >= 10 use comparison ops, not AND/OR)
    expect(c).toBe(4);
  });
});
