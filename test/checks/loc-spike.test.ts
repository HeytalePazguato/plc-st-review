import { describe, expect, it } from 'vitest';
import { parseSource } from '../../src/engine/parse.js';
import { review } from '../helpers/review.js';

const small = `FUNCTION_BLOCK FB_Grow
VAR i : INT; END_VAR
i := 1;
i := 2;
END_FUNCTION_BLOCK
`;

// Same POU, body grown well past +50%.
const grown = `FUNCTION_BLOCK FB_Grow
VAR i : INT; END_VAR
i := 1;
i := 2;
i := 3;
i := 4;
i := 5;
i := 6;
i := 7;
END_FUNCTION_BLOCK
`;

describe('LOC_SPIKE', () => {
  it('flags a POU whose loc grew by more than 50%', async () => {
    const before = await parseSource(small, 'FB_Grow.st');
    const after = await parseSource(grown, 'FB_Grow.st');
    const findings = review([before], [after]).filter(
      (f) => f.category === 'LOC_SPIKE',
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].summary).toMatch(/FB_Grow lines of code: \d+ → \d+ \(\+\d+%\)/);
  });

  it('stays silent for modest growth under 50%', async () => {
    const before = await parseSource(grown, 'FB_Grow.st'); // larger baseline
    const after = await parseSource(
      `FUNCTION_BLOCK FB_Grow
VAR i : INT; END_VAR
i := 1;
i := 2;
i := 3;
i := 4;
i := 5;
i := 6;
i := 7;
i := 8;
END_FUNCTION_BLOCK
`,
      'FB_Grow.st',
    );
    const findings = review([before], [after]).filter(
      (f) => f.category === 'LOC_SPIKE',
    );
    expect(findings).toHaveLength(0);
  });
});
