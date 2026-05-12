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
});
