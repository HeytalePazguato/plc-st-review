import { describe, expect, it } from 'vitest';
import {
  fbDecl,
  interfaceDecl,
  methodDecl,
  methodSignature,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('METHOD_ADDED_TO_INTERFACE', () => {
  it('flags an FB that does not implement a new interface method', () => {
    resetLines();
    const beforeIface = sourceFile('IDrivable.st', [
      interfaceDecl('IDrivable', [methodSignature('Start', 'BOOL')]),
    ]);
    resetLines();
    const beforeFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { implements: ['IDrivable'], methods: [methodDecl('Start')] }),
    ]);
    resetLines();
    const afterIface = sourceFile('IDrivable.st', [
      interfaceDecl('IDrivable', [
        methodSignature('Start', 'BOOL'),
        methodSignature('Stop', 'BOOL'),
      ]),
    ]);
    resetLines();
    const afterFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { implements: ['IDrivable'], methods: [methodDecl('Start')] }),
    ]);
    const findings = review([beforeIface, beforeFb], [afterIface, afterFb]);
    const m = findings.filter((f) => f.category === 'METHOD_ADDED_TO_INTERFACE');
    expect(m).toHaveLength(1);
    expect(m[0].severity).toBe('error');
    expect(m[0].summary).toContain('Stop');
  });

  it('does not flag implementers that have the new method', () => {
    resetLines();
    const beforeIface = sourceFile('IDrivable.st', [
      interfaceDecl('IDrivable', [methodSignature('Start', 'BOOL')]),
    ]);
    resetLines();
    const beforeFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', { implements: ['IDrivable'], methods: [methodDecl('Start')] }),
    ]);
    resetLines();
    const afterIface = sourceFile('IDrivable.st', [
      interfaceDecl('IDrivable', [
        methodSignature('Start', 'BOOL'),
        methodSignature('Stop', 'BOOL'),
      ]),
    ]);
    resetLines();
    const afterFb = sourceFile('FB_Pump.st', [
      fbDecl('FB_Pump', {
        implements: ['IDrivable'],
        methods: [methodDecl('Start'), methodDecl('Stop')],
      }),
    ]);
    const findings = review([beforeIface, beforeFb], [afterIface, afterFb]);
    expect(findings.filter((f) => f.category === 'METHOD_ADDED_TO_INTERFACE')).toHaveLength(0);
  });
});
