import { describe, expect, it } from 'vitest';
import {
  arrayVarDecl,
  fbDecl,
  localVars,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('ARRAY_SINGLE_ELEMENT', () => {
  it('flags an array [5..5]', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [
          localVars({}, arrayVarDecl({ name: 'arr', lower: '5', upper: '5', elementType: 'INT' })),
        ],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'ARRAY_SINGLE_ELEMENT');
    expect(f).toHaveLength(1);
  });
});
