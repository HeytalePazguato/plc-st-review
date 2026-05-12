import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  localVars,
  paramDecl,
  ptAssignment,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

function buildFb(name: string, ptValue: string) {
  resetLines();
  return fbDecl(name, {
    locals: [
      localVars({}, paramDecl({ name: 'T_StartupDelay', type: 'TON' })),
      ptAssignment('T_StartupDelay', ptValue),
    ],
  });
}

describe('TIMER_VALUE_CHANGED', () => {
  it('flags a 10x faster PT change as error', () => {
    const before = sourceFile('FB_Startup.st', [buildFb('FB_Startup', 'T#5s')]);
    const after = sourceFile('FB_Startup.st', [buildFb('FB_Startup', 'T#500ms')]);
    const findings = review([before], [after]);
    const tv = findings.filter((f) => f.category === 'TIMER_VALUE_CHANGED');
    expect(tv).toHaveLength(1);
    expect(tv[0].severity).toBe('error');
    expect(tv[0].summary).toContain('faster');
  });

  it('flags a 3x change as warn', () => {
    const before = sourceFile('FB_Slow.st', [buildFb('FB_Slow', 'T#1s')]);
    const after = sourceFile('FB_Slow.st', [buildFb('FB_Slow', 'T#3s')]);
    const findings = review([before], [after]);
    const tv = findings.filter((f) => f.category === 'TIMER_VALUE_CHANGED');
    expect(tv).toHaveLength(1);
    expect(tv[0].severity).toBe('warn');
  });

  it('flags a small change as info', () => {
    const before = sourceFile('FB_Tiny.st', [buildFb('FB_Tiny', 'T#1s')]);
    const after = sourceFile('FB_Tiny.st', [buildFb('FB_Tiny', 'T#1500ms')]);
    const findings = review([before], [after]);
    const tv = findings.filter((f) => f.category === 'TIMER_VALUE_CHANGED');
    expect(tv).toHaveLength(1);
    expect(tv[0].severity).toBe('info');
  });

  it('does not flag when PT is unchanged', () => {
    const before = sourceFile('FB_Stable.st', [buildFb('FB_Stable', 'T#1s')]);
    const after = sourceFile('FB_Stable.st', [buildFb('FB_Stable', 'T#1s')]);
    const findings = review([before], [after]);
    expect(findings.filter((f) => f.category === 'TIMER_VALUE_CHANGED')).toHaveLength(0);
  });
});
