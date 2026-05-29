import { describe, expect, it } from 'vitest';
import { parseSource } from '../src/engine/parse.js';
import { buildSymbolTable } from '../src/engine/symbols.js';
import { review } from './helpers/review.js';

describe('real tree-sitter parser', () => {
  it('parses a small FB declaration and extracts the symbol table', async () => {
    const src = `
FUNCTION_BLOCK FB_Pump
VAR_INPUT
    xEnable : BOOL;
    rSetpoint : REAL := 0.0;
END_VAR
VAR
    T_Delay : TON;
END_VAR
T_Delay(IN := xEnable, PT := T#5s);
END_FUNCTION_BLOCK
`;
    const ast = await parseSource(src, 'FB_Pump.st');
    expect(ast.root.type).toBe('source_file');
    const table = buildSymbolTable([ast]);
    expect(table.pous.has('FB_Pump')).toBe(true);
    const pump = table.pous.get('FB_Pump')!;
    expect(pump.kind).toBe('function_block');
    expect(pump.inputs.map((p) => p.name)).toEqual(['xEnable', 'rSetpoint']);
    expect(pump.inputs[1].initial).toBe('0.0');
    expect(table.timerInstances).toHaveLength(1);
    expect(table.timerInstances[0].timerType).toBe('TON');
    expect(table.callSites.length).toBeGreaterThan(0);
    const ton = table.callSites.find((c) => /T_Delay/.test(c.callee));
    expect(ton, 'expected a call site for T_Delay').toBeDefined();
    expect(ton!.namedArgs.get('PT')).toBe('T#5s');
    expect(table.timerPtAssignments).toHaveLength(1);
    expect(table.timerPtAssignments[0].ptValue).toBe('T#5s');
  });

  it('detects a TIMER_VALUE_CHANGED across two real ASTs', async () => {
    const before = await parseSource(
      `
FUNCTION_BLOCK FB_Startup
VAR
    T_Delay : TON;
END_VAR
T_Delay(IN := TRUE, PT := T#5s);
END_FUNCTION_BLOCK
`,
      'FB_Startup.st',
    );
    const after = await parseSource(
      `
FUNCTION_BLOCK FB_Startup
VAR
    T_Delay : TON;
END_VAR
T_Delay(IN := TRUE, PT := T#500ms);
END_FUNCTION_BLOCK
`,
      'FB_Startup.st',
    );
    const findings = review([before], [after]);
    const tv = findings.filter((f) => f.category === 'TIMER_VALUE_CHANGED');
    expect(tv).toHaveLength(1);
    expect(tv[0].severity).toBe('error');
    expect(tv[0].summary).toContain('T#5s');
    expect(tv[0].summary).toContain('T#500ms');
  });

  it('detects SIGNATURE_CHANGED across two real ASTs', async () => {
    const before = await parseSource(
      `
FUNCTION_BLOCK FB_Pump
VAR_INPUT
    xEnable : BOOL;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_Pump.st',
    );
    const after = await parseSource(
      `
FUNCTION_BLOCK FB_Pump
VAR_INPUT
    xEnable : BOOL;
    xManualOverride : BOOL;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_Pump.st',
    );
    const findings = review([before], [after]);
    const sig = findings.filter((f) => f.category === 'SIGNATURE_CHANGED');
    expect(sig).toHaveLength(1);
    expect(sig[0].severity).toBe('error');
    expect(sig[0].detail).toContain('xManualOverride');
  });

  it('does NOT flag the `;` after structured statement terminators as EMPTY_STATEMENT', async () => {
    // The tree-sitter-iec61131-3-st grammar treats `;` as `empty_statement`
    // and the structured-statement rules (for/if/while/repeat/case/
    // invocation/pragma) do NOT consume their trailing `;`. So every
    // `END_FOR;`, `END_IF;`, `T1(...);` etc. produced a phantom
    // empty_statement in the AST. The collector skips those by
    // checking previousNamedSibling.
    const before = await parseSource(
      `FUNCTION_BLOCK FB_Trivial
END_FUNCTION_BLOCK
`,
      'FB_Trivial.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_Trivial
VAR
    iCounter : INT;
    T1 : TON;
END_VAR
FOR iCounter := 1 TO 10 BY 1 DO
    iCounter := iCounter + 1;
END_FOR;
IF iCounter > 5 THEN
    iCounter := 0;
END_IF;
WHILE iCounter < 10 DO
    iCounter := iCounter + 1;
END_WHILE;
T1(IN := TRUE, PT := T#1s);
;
END_FUNCTION_BLOCK
`,
      'FB_Trivial.st',
    );
    const findings = review([before], [after]);
    const empty = findings.filter((f) => f.category === 'EMPTY_STATEMENT');
    // The four structured-statement terminators (`END_FOR;`, `END_IF;`,
    // `END_WHILE;`, `T1(...);`) must not fire. Only the lone `;` at the
    // bottom of the body is a real empty statement.
    expect(empty).toHaveLength(1);
  });

  // The next four cover checks that the synthetic AST fixtures can't
  // exercise faithfully, they depend on real parser shapes (ERROR
  // recovery nodes, address_of_expression, instance→type resolution,
  // LHS/RHS reference context). Each was silently producing zero
  // findings before the fix.

  it('flags ASSIGNMENT_IN_CONDITION even though `IF x := y` parses as an ERROR node', async () => {
    // `IF iCounter := 0 THEN` is invalid ST, `:=` is illegal in an
    // expression, so tree-sitter emits an ERROR node (`:= 0`), not an
    // assignment_statement. The check detects the ERROR-node shape.
    const before = await parseSource(
      `FUNCTION_BLOCK FB_C
VAR
    iCounter : INT;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_C.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_C
VAR
    iCounter : INT;
END_VAR
IF iCounter := 0 THEN
    iCounter := 1;
END_IF;
END_FUNCTION_BLOCK
`,
      'FB_C.st',
    );
    const findings = review([before], [after]);
    expect(
      findings.filter((f) => f.category === 'ASSIGNMENT_IN_CONDITION'),
    ).toHaveLength(1);
  });

  it('flags ADDRESS_OF_CONSTANT for ADR() of a VAR_GLOBAL CONSTANT', async () => {
    // `ADR(x)` parses as `address_of_expression`, not call_expression, so
    // it never reached collectCallSites, the check now reads a dedicated
    // addressOfExprs collection.
    const globals = `VAR_GLOBAL CONSTANT
    SAFETY_TIMEOUT : TIME := T#10s;
END_VAR
`;
    const before = await parseSource(
      `${globals}FUNCTION_BLOCK FB_A
VAR
    i : INT;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_A.st',
    );
    const after = await parseSource(
      `${globals}FUNCTION_BLOCK FB_A
VAR
    i : INT;
END_VAR
i := ADR(SAFETY_TIMEOUT);
END_FUNCTION_BLOCK
`,
      'FB_A.st',
    );
    const findings = review([before], [after]);
    const hits = findings.filter((f) => f.category === 'ADDRESS_OF_CONSTANT');
    expect(hits).toHaveLength(1);
    expect(hits[0].summary).toContain('SAFETY_TIMEOUT');
  });

  it('flags RECURSIVE_CALL through a self-typed instance (fbSelf : FB_Self)', async () => {
    // `fbSelf()` where `fbSelf : FB_Self` inside FB_Self, the callee name
    // is the instance, not the type, so the check resolves it via the
    // per-POU locals catalogue.
    const before = await parseSource(
      `FUNCTION_BLOCK FB_Self
END_FUNCTION_BLOCK
`,
      'FB_Self.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_Self
VAR
    fbSelf : FB_Self;
END_VAR
fbSelf();
END_FUNCTION_BLOCK
`,
      'FB_Self.st',
    );
    const findings = review([before], [after]);
    expect(
      findings.filter((f) => f.category === 'RECURSIVE_CALL'),
    ).toHaveLength(1);
  });

  it('flags OUTPUT_VAR_READ_INTERNALLY when the output is read on its own write line', async () => {
    // `rOut := rOut + 1.0;` reads and writes rOut on one line. The old
    // same-line heuristic masked the read; reference context now
    // distinguishes the LHS write from the RHS read.
    const before = await parseSource(
      `FUNCTION_BLOCK FB_O
VAR_OUTPUT
    rOut : REAL;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_O.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_O
VAR_OUTPUT
    rOut : REAL;
END_VAR
rOut := rOut + 1.0;
END_FUNCTION_BLOCK
`,
      'FB_O.st',
    );
    const findings = review([before], [after]);
    expect(
      findings.filter((f) => f.category === 'OUTPUT_VAR_READ_INTERNALLY'),
    ).toHaveLength(1);
  });

  it('does NOT flag OUTPUT_VAR_READ_INTERNALLY for a write-only output', async () => {
    // Regression: refContext used object identity (`child === lhs`) to find
    // the assignment target, but tree-sitter hands back a fresh wrapper on
    // every access, so the identity never held and EVERY assignment LHS was
    // misclassified as a read. A write-only output (assigned, never read on
    // any RHS) was therefore flagged. refContext now compares node positions.
    const before = await parseSource(
      `FUNCTION_BLOCK FB_W
VAR_OUTPUT
    rOut : REAL;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_W.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_W
VAR_OUTPUT
    rOut : REAL;
END_VAR
VAR
    rLocal : REAL;
END_VAR
rLocal := 1.0;
rOut := rLocal;
END_FUNCTION_BLOCK
`,
      'FB_W.st',
    );
    const findings = review([before], [after]);
    expect(
      findings.filter((f) => f.category === 'OUTPUT_VAR_READ_INTERNALLY'),
    ).toHaveLength(0);
  });

  // Case-sensitivity is dialect-dependent: generic IEC / TwinCAT / CODESYS are
  // case-insensitive (the default), B&R Automation Studio is case-sensitive
  // (`caseSensitive: true`). The symbol-table identifier maps key through the
  // shared CaseMap so insertion and lookup always agree.

  const shadowGlobals = `VAR_GLOBAL
    Level : INT;
END_VAR
`;
  const shadowBefore = `${shadowGlobals}FUNCTION_BLOCK FB_X
END_FUNCTION_BLOCK
`;
  const shadowAfter = `${shadowGlobals}FUNCTION_BLOCK FB_X
VAR
    level : INT;
END_VAR
END_FUNCTION_BLOCK
`;

  it('case-insensitive (default): a local shadowing a different-cased global is flagged', async () => {
    const before = await parseSource(shadowBefore, 'FB_X.st');
    const after = await parseSource(shadowAfter, 'FB_X.st');
    const findings = review([before], [after]);
    expect(
      findings.filter((f) => f.category === 'VARIABLE_SHADOWING'),
    ).toHaveLength(1);
  });

  it('case-sensitive mode: a different-cased local does NOT shadow the global', async () => {
    const before = await parseSource(shadowBefore, 'FB_X.st');
    const after = await parseSource(shadowAfter, 'FB_X.st');
    const findings = review([before], [after], { caseSensitive: true });
    expect(
      findings.filter((f) => f.category === 'VARIABLE_SHADOWING'),
    ).toHaveLength(0);
  });

  it('case-insensitive (default): a lowercase `pt :=` still resolves for TIMER_PT_ZERO', async () => {
    // M8: standard FB parameter names are looked up via namedArgs.get('PT').
    // Before the CaseMap fix, a lowercase `pt :=` was missed.
    const before = await parseSource(
      `FUNCTION_BLOCK FB_T
VAR
    T1 : TON;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_T.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_T
VAR
    T1 : TON;
END_VAR
T1(IN := TRUE, pt := T#0s);
END_FUNCTION_BLOCK
`,
      'FB_T.st',
    );
    const findings = review([before], [after]);
    expect(
      findings.filter((f) => f.category === 'TIMER_PT_ZERO'),
    ).toHaveLength(1);
  });

  it('IDENTIFIER_CASE_MISMATCH fires by default but is disabled in case-sensitive mode', async () => {
    const before = await parseSource(
      `FUNCTION_BLOCK FB_M
VAR
    iCount : INT;
END_VAR
END_FUNCTION_BLOCK
`,
      'FB_M.st',
    );
    const after = await parseSource(
      `FUNCTION_BLOCK FB_M
VAR
    iCount : INT;
END_VAR
ICOUNT := iCount + 1;
END_FUNCTION_BLOCK
`,
      'FB_M.st',
    );
    const insensitive = review([before], [after]);
    expect(
      insensitive.filter((f) => f.category === 'IDENTIFIER_CASE_MISMATCH').length,
    ).toBeGreaterThanOrEqual(1);
    const sensitive = review([before], [after], { caseSensitive: true });
    expect(
      sensitive.filter((f) => f.category === 'IDENTIFIER_CASE_MISMATCH'),
    ).toHaveLength(0);
  });
});
