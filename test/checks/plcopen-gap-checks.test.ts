import { describe, expect, it } from 'vitest';
import { parseSource } from '../../src/engine/parse.js';
import { review } from '../helpers/review.js';

async function reviewSrc(src: string, configPatch = {}, projectSrc?: string) {
  const ast = await parseSource(src, 't.st');
  const projectFiles = projectSrc
    ? [await parseSource(projectSrc, 'p.st')]
    : undefined;
  return review([], [ast], configPatch, projectFiles);
}

// The 6 PLCopen rules surfaced by the iec-checker comparison.

describe('PLCopen gap checks (real parser)', () => {
  it('CP3 — UNINITIALIZED_VAR_USED fires when a local is read before any assignment', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_U
VAR
    x : INT;
    y : INT;
END_VAR
y := x + 1;
x := 1;
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'UNINITIALIZED_VAR_USED');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen CP3');
  });

  it('CP3 — does NOT fire when the local has an initial value', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_U
VAR
    x : INT := 0;
    y : INT;
END_VAR
y := x + 1;
END_FUNCTION_BLOCK
`,
    );
    expect(findings.filter((f) => f.category === 'UNINITIALIZED_VAR_USED')).toHaveLength(0);
  });

  it('CP6 — EXTERNAL_VAR_IN_FUNCTION fires on VAR_EXTERNAL inside a FUNCTION_BLOCK', async () => {
    const findings = await reviewSrc(
      `VAR_GLOBAL gFlow : REAL; END_VAR
FUNCTION_BLOCK FB_X
VAR_EXTERNAL
    gFlow : REAL;
END_VAR
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'EXTERNAL_VAR_IN_FUNCTION');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen CP6');
  });

  it('CP28 — TIME_EQUALITY fires on `= T#5s` and `<>` of TIME-typed values', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_T
VAR
    tElapsed : TIME;
    bDone    : BOOL;
END_VAR
bDone := tElapsed = T#5s;
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'TIME_EQUALITY');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen CP28');
  });

  it('N8 — IDENTIFIER_CHARSET fires only when configured', async () => {
    // Mixed-case names that fail a strict UPPER_ONLY pattern.
    const src = `FUNCTION_BLOCK FB_A
VAR
    mixedCase : INT;
END_VAR
END_FUNCTION_BLOCK
`;
    const offByDefault = await reviewSrc(src);
    expect(offByDefault.filter((f) => f.category === 'IDENTIFIER_CHARSET')).toHaveLength(0);

    const withPattern = await reviewSrc(src, {
      identifierCharsetPattern: '^[A-Z][A-Z0-9_]*$',
    });
    const hits = withPattern.filter((f) => f.category === 'IDENTIFIER_CHARSET');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen N8');
  });

  it('CP25 — IMPLICIT_TYPE_CONVERSION fires when INT and REAL operands are mixed', async () => {
    const findings = await reviewSrc(
      `FUNCTION_BLOCK FB_M
VAR
    i : INT;
    r : REAL;
END_VAR
r := i + 1.5;
END_FUNCTION_BLOCK
`,
    );
    const hits = findings.filter((f) => f.category === 'IMPLICIT_TYPE_CONVERSION');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen CP25');
  });

  it('CP26 — MULTI_WRITER_GLOBAL fires when two PROGRAMs write to the same global', async () => {
    // Project-scoped check: needs the whole-repo table.
    const projectSrc = `VAR_GLOBAL
    gFlow : REAL;
END_VAR
PROGRAM PRG_A
gFlow := 1.0;
END_PROGRAM
PROGRAM PRG_B
gFlow := 2.0;
END_PROGRAM
`;
    const findings = await reviewSrc(
      `(* PR changes don't matter; the project-scope walk picks up both writers. *)
PROGRAM PRG_A
gFlow := 1.0;
END_PROGRAM
`,
      {},
      projectSrc,
    );
    const hits = findings.filter((f) => f.category === 'MULTI_WRITER_GLOBAL');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].summary).toContain('PLCopen CP26');
    expect(hits[0].severity).toBe('error');
  });
});
