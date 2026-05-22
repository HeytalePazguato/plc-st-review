import { describe, expect, it } from 'vitest';
import { buildCallGraph } from '../../src/engine/metrics/callgraph.js';
import { parseSource } from '../../src/engine/parse.js';
import { buildSymbolTable } from '../../src/engine/symbols.js';

async function graphOf(...srcs: string[]) {
  const files = await Promise.all(
    srcs.map((s, i) => parseSource(s, `f${i}.st`)),
  );
  return buildCallGraph(buildSymbolTable(files));
}

describe('call graph', () => {
  it('resolves an instance call to its FB type for fan-in / fan-out', async () => {
    const g = await graphOf(
      `FUNCTION_BLOCK FB_A
VAR inst : FB_B; END_VAR
inst(x := 1);
END_FUNCTION_BLOCK
`,
      `FUNCTION_BLOCK FB_B
VAR i : INT; END_VAR
i := 1;
END_FUNCTION_BLOCK
`,
    );
    expect(g.fanOut.get('FB_A')).toBe(1);
    expect(g.fanIn.get('FB_B')).toBe(1);
    expect(g.fanIn.get('FB_A')).toBe(0);
  });

  it('reports FUNCTION_BLOCKs that nothing calls as dead', async () => {
    const g = await graphOf(
      `FUNCTION_BLOCK FB_A
VAR inst : FB_B; END_VAR
inst();
END_FUNCTION_BLOCK
`,
      `FUNCTION_BLOCK FB_B
VAR i : INT; END_VAR
i := 1;
END_FUNCTION_BLOCK
`,
    );
    // FB_A is never called; FB_B is called by FB_A.
    expect(g.deadPous).toEqual(['FB_A']);
  });

  it('excludes PROGRAMs from dead-code (they are entry points)', async () => {
    const g = await graphOf(
      `PROGRAM MAIN
VAR inst : FB_B; END_VAR
inst();
END_PROGRAM
`,
      `FUNCTION_BLOCK FB_B
VAR i : INT; END_VAR
i := 1;
END_FUNCTION_BLOCK
`,
    );
    expect(g.deadPous).toEqual([]);
  });

  it('detects a mutual-recursion cycle', async () => {
    const g = await graphOf(
      `FUNCTION_BLOCK FB_X
VAR y : FB_Y; END_VAR
y();
END_FUNCTION_BLOCK
`,
      `FUNCTION_BLOCK FB_Y
VAR x : FB_X; END_VAR
x();
END_FUNCTION_BLOCK
`,
    );
    expect(g.cycles).toHaveLength(1);
    expect(g.cycles[0]).toEqual(['FB_X', 'FB_Y']);
  });

  it('measures dependency depth along the longest chain', async () => {
    const g = await graphOf(
      `FUNCTION_BLOCK FB_A
VAR b : FB_B; END_VAR
b();
END_FUNCTION_BLOCK
`,
      `FUNCTION_BLOCK FB_B
VAR c : FB_C; END_VAR
c();
END_FUNCTION_BLOCK
`,
      `FUNCTION_BLOCK FB_C
VAR i : INT; END_VAR
i := 1;
END_FUNCTION_BLOCK
`,
    );
    // A -> B -> C
    expect(g.dependencyDepth).toBe(3);
  });
});
