import { describe, expect, it } from 'vitest';
import { computeFileMetrics } from '../../src/engine/metrics/pou-metrics.js';
import { parseSource } from '../../src/engine/parse.js';

describe('line metrics', () => {
  it('excludes blank and comment-only lines from loc, counts them in total', async () => {
    const src = `FUNCTION_BLOCK FB_Loc
VAR x : INT; END_VAR
// a comment line
x := 1;

(* block
   comment *)
x := 2;
END_FUNCTION_BLOCK
`;
    const ast = await parseSource(src, 'FB_Loc.st');
    const m = computeFileMetrics(ast).get('FB_Loc');
    expect(m).toBeDefined();
    // 9 lines in the POU span: 5 carry code, 1 blank, 3 comment-only.
    expect(m!.locTotal).toBe(9);
    expect(m!.loc).toBe(5);
    expect(Math.round(m!.commentRatio)).toBe(33);
  });

  it('keeps a line that has code followed by a trailing comment', async () => {
    const src = `FUNCTION FC_Trail : INT
FC_Trail := 1; // set result
END_FUNCTION
`;
    const ast = await parseSource(src, 'FC_Trail.st');
    const m = computeFileMetrics(ast).get('FC_Trail');
    expect(m).toBeDefined();
    // All 3 lines carry code (the middle line keeps its assignment).
    expect(m!.loc).toBe(3);
    expect(m!.locTotal).toBe(3);
  });
});
