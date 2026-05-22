import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../../src/config.js';
import { parseSource } from '../../src/engine/parse.js';
import { runReview } from '../../src/engine/review.js';

const hub = `FUNCTION_BLOCK FB_Hub
VAR i : INT; END_VAR
i := 1;
END_FUNCTION_BLOCK
`;
const newFb = `FUNCTION_BLOCK FB_New
VAR i : INT; END_VAR
i := 2;
END_FUNCTION_BLOCK
`;
const caller = `FUNCTION_BLOCK FB_Caller
VAR n : FB_New; END_VAR
n();
END_FUNCTION_BLOCK
`;

function deadFindings(input: Parameters<typeof runReview>[0]) {
  return runReview(input).filter((f) => f.category === 'DEAD_POU_INTRODUCED');
}

describe('DEAD_POU_INTRODUCED', () => {
  it('flags a newly added FB that nothing in the project calls', async () => {
    const findings = deadFindings({
      beforeFiles: [await parseSource(hub, 'hub.st')],
      afterFiles: [await parseSource(newFb, 'new.st')],
      projectFiles: [
        await parseSource(hub, 'hub.st'),
        await parseSource(newFb, 'new.st'),
      ],
      config: DEFAULT_CONFIG,
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].summary).toContain('FB_New');
  });

  it('does not flag when something in the project calls it', async () => {
    const findings = deadFindings({
      beforeFiles: [await parseSource(hub, 'hub.st')],
      afterFiles: [await parseSource(newFb, 'new.st')],
      projectFiles: [
        await parseSource(hub, 'hub.st'),
        await parseSource(newFb, 'new.st'),
        await parseSource(caller, 'caller.st'),
      ],
      config: DEFAULT_CONFIG,
    });
    expect(findings).toHaveLength(0);
  });

  it('is skipped when no project scope is provided', async () => {
    const findings = deadFindings({
      beforeFiles: [await parseSource(hub, 'hub.st')],
      afterFiles: [await parseSource(newFb, 'new.st')],
      config: DEFAULT_CONFIG,
    });
    expect(findings).toHaveLength(0);
  });
});
