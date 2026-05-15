import type { Check, CommentNode, Finding } from '../types.js';

function hasNested(c: CommentNode): boolean {
  // Block comment `(* ... (* nested *) ... *)`: the inner `(*` after the
  // opener indicates nesting.
  if (!c.text.startsWith('(*')) return false;
  const inner = c.text.slice(2, c.text.length - 2);
  return inner.includes('(*');
}

function key(c: CommentNode): string {
  return `${c.file}::${c.line}`;
}

export const nestedComments: Check = {
  category: 'NESTED_COMMENTS',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(ctx.before.comments.filter(hasNested).map(key));
    for (const c of ctx.after.comments) {
      if (!hasNested(c)) continue;
      if (before.has(key(c))) continue;
      findings.push({
        severity: 'info',
        category: 'NESTED_COMMENTS',
        file: c.file,
        line: c.line,
        summary: 'Nested block comment',
        detail:
          'IEC 61131-3 implementations differ on whether `(* outer (* inner *) *)` is valid. Some treat the first `*)` as the comment terminator, leaving the rest as code. Replace nested blocks with single-line `//` comments or join them.',
      });
    }
    return findings;
  },
};
