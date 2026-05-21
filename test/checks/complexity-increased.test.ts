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

const simple = `FUNCTION_BLOCK FB_Seq
VAR_INPUT x : INT; END_VAR
VAR y : INT; END_VAR
y := x;
END_FUNCTION_BLOCK
`;

const branchy = `FUNCTION_BLOCK FB_Seq
VAR_INPUT x : INT; END_VAR
VAR y : INT; END_VAR
IF x = 0 THEN y := 0;
ELSIF x = 1 THEN y := 1;
ELSIF x = 2 THEN y := 2;
ELSIF x = 3 THEN y := 3;
ELSIF x = 4 THEN y := 4;
ELSIF x = 5 THEN y := 5;
ELSIF x = 6 THEN y := 6;
END_IF;
END_FUNCTION_BLOCK
`;

describe('COMPLEXITY_INCREASED', () => {
  it('warns when complexity rises by more than 5', async () => {
    const before = await parseSource(simple, 'FB_Seq.st');
    const after = await parseSource(branchy, 'FB_Seq.st');
    // before complexity 1, after 1 + IF + 6 ELSIF = 8 -> +7
    const findings = review([before], [after]).filter(
      (f) => f.category === 'COMPLEXITY_INCREASED',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('warn');
    expect(findings[0].summary).toContain('1 → 8');
  });

  it('escalates to error when the new value crosses the error threshold', async () => {
    const before = await parseSource(simple, 'FB_Seq.st');
    const after = await parseSource(branchy, 'FB_Seq.st');
    const findings = review([before], [after], {
      metricsThresholds: thresholds({ cyclomaticComplexity: { warn: 2, error: 5 } }),
    }).filter((f) => f.category === 'COMPLEXITY_INCREASED');
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('error');
    expect(findings[0].summary).toContain('crossed error threshold of 5');
  });

  it('stays silent for a small increase that does not cross a threshold', async () => {
    const before = await parseSource(simple, 'FB_Seq.st');
    const after = await parseSource(
      `FUNCTION_BLOCK FB_Seq
VAR_INPUT x : INT; END_VAR
VAR y : INT; END_VAR
IF x = 0 THEN y := 0; ELSIF x = 1 THEN y := 1; END_IF;
END_FUNCTION_BLOCK
`,
      'FB_Seq.st',
    );
    // before 1, after 1 + IF + ELSIF = 3 -> +2, below the >5 bar, default thresholds
    const findings = review([before], [after]).filter(
      (f) => f.category === 'COMPLEXITY_INCREASED',
    );
    expect(findings).toHaveLength(0);
  });
});
