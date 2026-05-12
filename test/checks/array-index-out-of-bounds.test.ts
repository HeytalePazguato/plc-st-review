import { describe, expect, it } from 'vitest';
import {
  arrayVarDecl,
  fbDecl,
  indexExpression,
  localVars,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ARRAY_INDEX_OUT_OF_BOUNDS', () => {
  it('flags a literal index above the upper bound', () => {
    resetLines();
    const before = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' })),
        ],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' })),
          indexExpression('arr', '15'),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'ARRAY_INDEX_OUT_OF_BOUNDS');
    expect(f).toHaveLength(1);
    expect(f[0].summary).toContain('arr[15]');
    expect(f[0].summary).toContain('[0..9]');
  });

  it('flags a negative index below the lower bound', () => {
    resetLines();
    const before = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, arrayVarDecl({ name: 'arr', lower: '1', upper: '10', elementType: 'INT' })),
        ],
      }),
    ]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, arrayVarDecl({ name: 'arr', lower: '1', upper: '10', elementType: 'INT' })),
          indexExpression('arr', '0'),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'ARRAY_INDEX_OUT_OF_BOUNDS');
    expect(f).toHaveLength(1);
  });

  it('does not flag dynamic (variable) indices', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, arrayVarDecl({ name: 'arr', lower: '0', upper: '9', elementType: 'INT' })),
          indexExpression('arr', 'i'),
        ],
      }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'ARRAY_INDEX_OUT_OF_BOUNDS')).toHaveLength(0);
  });
});
