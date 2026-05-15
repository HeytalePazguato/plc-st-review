import { describe, expect, it } from 'vitest';
import {
  commentNode,
  fbDecl,
  resetLines,
  sourceFile,
} from '../helpers/ast-fixtures.js';
import { review } from '../helpers/review.js';

describe('NESTED_COMMENTS', () => {
  it('flags a comment with a nested block comment inside', () => {
    resetLines();
    const before = sourceFile('FB.st', [fbDecl('FB', {})]);
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', {
        locals: [commentNode('(* outer (* nested *) text *)')],
      }),
    ]);
    const findings = review([before], [after]);
    const f = findings.filter((x) => x.category === 'NESTED_COMMENTS');
    expect(f).toHaveLength(1);
  });

  it('does not flag a flat block comment', () => {
    resetLines();
    const after = sourceFile('FB.st', [
      fbDecl('FB', { locals: [commentNode('(* a regular comment *)')] }),
    ]);
    const findings = review([after], [after]);
    expect(findings.filter((x) => x.category === 'NESTED_COMMENTS')).toHaveLength(0);
  });
});
