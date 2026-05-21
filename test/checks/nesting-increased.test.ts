import { describe, expect, it } from 'vitest';
import { parseSource } from '../../src/engine/parse.js';
import type { MetricsThresholds } from '../../src/engine/types.js';
import { review } from '../helpers/review.js';

const thresholds = (overrides: Partial<MetricsThresholds> = {}): MetricsThresholds => ({
  cyclomaticComplexity: { warn: 15, error: 25 },
  nestingDepth: { warn: 5, error: 8 },
  linesOfCode: { warn: 300, error: 600 },
  commentRatio: { warnBelow: 10 },
  fanOut: { warn: 15, error: 25 },
  ...overrides,
});

const shallow = `FUNCTION_BLOCK FB_Nest
VAR_INPUT a : BOOL; END_VAR
VAR i : INT; END_VAR
IF a THEN i := 1; END_IF;
END_FUNCTION_BLOCK
`;

const deep = `FUNCTION_BLOCK FB_Nest
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
`;

describe('NESTING_INCREASED', () => {
  it('warns when nesting increases beyond the warn threshold', async () => {
    const before = await parseSource(shallow, 'FB_Nest.st');
    const after = await parseSource(deep, 'FB_Nest.st');
    // before depth 1, after depth 3, warn threshold lowered to 2
    const findings = review([before], [after], {
      metricsThresholds: thresholds({ nestingDepth: { warn: 2, error: 8 } }),
    }).filter((f) => f.category === 'NESTING_INCREASED');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warn');
    expect(findings[0].summary).toContain('1 → 3');
  });

  it('escalates to error when nesting crosses the error threshold', async () => {
    const before = await parseSource(shallow, 'FB_Nest.st');
    const after = await parseSource(deep, 'FB_Nest.st');
    const findings = review([before], [after], {
      metricsThresholds: thresholds({ nestingDepth: { warn: 1, error: 3 } }),
    }).filter((f) => f.category === 'NESTING_INCREASED');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].summary).toContain('crossed error threshold of 3');
  });

  it('stays silent when the new depth is still within the warn threshold', async () => {
    const before = await parseSource(shallow, 'FB_Nest.st');
    const after = await parseSource(deep, 'FB_Nest.st');
    // default warn threshold 5, after depth is only 3
    const findings = review([before], [after]).filter(
      (f) => f.category === 'NESTING_INCREASED',
    );
    expect(findings).toHaveLength(0);
  });
});
