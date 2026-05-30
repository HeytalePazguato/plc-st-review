import { describe, expect, it } from 'vitest';
import { parseSource } from '../../src/engine/parse.js';
import { review } from '../helpers/review.js';

// One real-parser test per new PLCopen check. Each asserts the rule fires on
// a positive case and stays quiet on a negative one. The PLCopen check IDs
// (N1, N6, C2, L10, L12, L13, L17, CP13, CP18, CP23, E2, E3) appear in the
// summaries so a finding's origin is obvious in the bot output.

async function reviewSrc(src: string, configPatch = {}) {
  const ast = await parseSource(src, 't.st');
  return review([], [ast], configPatch);
}

describe('PLCopen checks (real parser)', () => {
  it('N1 / CP1 — DIRECT_ADDRESS_USED fires on %I / %Q references', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_A
VAR
    b : BOOL;
END_VAR
b := %I0.0;
%Q0.1 := b;
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'DIRECT_ADDRESS_USED');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0].summary).toContain('PLCopen');
  });

  it('L17 — IF_WITHOUT_ELSE fires on an IF with no ELSE, quiet on one with ELSE', async () => {
    const noElse = await reviewSrc(
      `FUNCTION_BLOCK FB_A
VAR x : INT; END_VAR
IF x > 0 THEN
    x := x + 1;
END_IF;
END_FUNCTION_BLOCK
`,
    );
    expect(noElse.filter((f) => f.category === 'IF_WITHOUT_ELSE')).toHaveLength(1);

    const withElse = await reviewSrc(
      `FUNCTION_BLOCK FB_A
VAR x : INT; END_VAR
IF x > 0 THEN
    x := x + 1;
ELSE
    x := 0;
END_IF;
END_FUNCTION_BLOCK
`,
    );
    expect(withElse.filter((f) => f.category === 'IF_WITHOUT_ELSE')).toHaveLength(0);
  });

  it('L10 — FORBIDDEN_STATEMENT fires on EXIT and CONTINUE', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_A
VAR i : INT; x : INT; END_VAR
WHILE i < 10 DO
    IF i = 5 THEN EXIT; END_IF;
    IF i = 3 THEN CONTINUE; END_IF;
    i := i + 1;
END_WHILE;
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'FORBIDDEN_STATEMENT');
    const kinds = new Set(hits.map((f) => f.summary.split(' ')[0]));
    expect(kinds.has('EXIT')).toBe(true);
    expect(kinds.has('CONTINUE')).toBe(true);
  });

  it('L12 — FOR_LOOP_VAR_MODIFIED fires when the counter is assigned inside the body', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_A
VAR i : INT; END_VAR
FOR i := 1 TO 10 DO
    i := i + 2;
END_FOR;
END_FUNCTION_BLOCK
`,
    );
    expect(findings.filter((f) => f.category === 'FOR_LOOP_VAR_MODIFIED').length).toBeGreaterThanOrEqual(1);
  });

  it('N6 — IDENTIFIER_TOO_LONG fires only when limits.maxIdentifierLength is set', async () => {
    const src = `FUNCTION_BLOCK FB_A
VAR
    aVeryLongIdentifierNameThatGoesOnAndOnAndOn : INT;
END_VAR
END_FUNCTION_BLOCK
`;
    const offByDefault = await reviewSrc(src);
    expect(offByDefault.filter((f) => f.category === 'IDENTIFIER_TOO_LONG')).toHaveLength(0);

    const withCap = await reviewSrc(src, {
      limits: { maxIdentifierLength: 24, maxGlobalsUsedPerPou: null, maxParameters: null },
    });
    const hits = withCap.filter((f) => f.category === 'IDENTIFIER_TOO_LONG');
    expect(hits).toHaveLength(1);
    expect(hits[0].summary).toContain('PLCopen N6');
  });

  it('N9 — NAME_REUSED_DIFFERENT_KIND fires across kinds', async () => {
    const findings = await reviewSrc(
      `VAR_GLOBAL
    status : INT;
END_VAR
TYPE status : (IDLE, ACTIVE); END_TYPE
`,
    );
    expect(findings.filter((f) => f.category === 'NAME_REUSED_DIFFERENT_KIND').length).toBeGreaterThanOrEqual(1);
  });

  it('C2 — POU_NOT_COMMENTED fires on an undocumented POU', async () => {
    const undocumented = await reviewSrc(
      `FUNCTION_BLOCK FB_Bare
END_FUNCTION_BLOCK
`,
    );
    expect(undocumented.filter((f) => f.category === 'POU_NOT_COMMENTED')).toHaveLength(1);

    const commented = await reviewSrc(
      `(* FB_Doc: does a thing. *)
FUNCTION_BLOCK FB_Doc
END_FUNCTION_BLOCK
`,
    );
    expect(commented.filter((f) => f.category === 'POU_NOT_COMMENTED')).toHaveLength(0);
  });

  it('CP23 — TOO_MANY_PARAMETERS fires when the cap is set and exceeded', async () => {
    const src = `FUNCTION_BLOCK FB_Wide
VAR_INPUT
    a : INT;
    b : INT;
    c : INT;
    d : INT;
    e : INT;
    f : INT;
END_VAR
END_FUNCTION_BLOCK
`;
    const offByDefault = await reviewSrc(src);
    expect(offByDefault.filter((f) => f.category === 'TOO_MANY_PARAMETERS')).toHaveLength(0);

    const withCap = await reviewSrc(src, {
      limits: { maxParameters: 3, maxIdentifierLength: null, maxGlobalsUsedPerPou: null },
    });
    expect(withCap.filter((f) => f.category === 'TOO_MANY_PARAMETERS')).toHaveLength(1);
  });

  it('CP18 — TOO_MANY_GLOBALS_USED counts distinct globals referenced from a POU', async () => {
    const src = `VAR_GLOBAL
    gA : INT;
    gB : INT;
    gC : INT;
    gD : INT;
END_VAR
FUNCTION_BLOCK FB_X
VAR x : INT; END_VAR
x := gA + gB + gC + gD;
END_FUNCTION_BLOCK
`;
    const offByDefault = await reviewSrc(src);
    expect(offByDefault.filter((f) => f.category === 'TOO_MANY_GLOBALS_USED')).toHaveLength(0);

    const withCap = await reviewSrc(src, {
      limits: { maxGlobalsUsedPerPou: 2, maxIdentifierLength: null, maxParameters: null },
    });
    expect(withCap.filter((f) => f.category === 'TOO_MANY_GLOBALS_USED')).toHaveLength(1);
  });

  it('E2 — POINTER_ARITHMETIC fires on `ptr + n`', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_P
VAR
    pAddr : POINTER TO INT;
    i     : INT;
END_VAR
pAddr := pAddr + 1;
END_FUNCTION_BLOCK
`,
    );
    expect(findings.filter((f) => f.category === 'POINTER_ARITHMETIC').length).toBeGreaterThanOrEqual(1);
  });

  it('E3 — POINTER_COMPARED fires on a relational compare of a pointer', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_P
VAR
    pA, pB : POINTER TO INT;
    b      : BOOL;
END_VAR
b := pA < pB;
END_FUNCTION_BLOCK
`,
    );
    expect(findings.filter((f) => f.category === 'POINTER_COMPARED').length).toBeGreaterThanOrEqual(1);
  });

  it('CP13 indirect — INDIRECT_RECURSIVE_CALL fires when A → B → A', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_A
VAR fb : FB_B; END_VAR
fb();
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_B
VAR fa : FB_A; END_VAR
fa();
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'INDIRECT_RECURSIVE_CALL');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen CP13');
  });
});
