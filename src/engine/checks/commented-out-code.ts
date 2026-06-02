import type { Check, CommentNode, Finding } from '../types.js';

// Patterns that almost only appear in real ST code, not in prose comments.
//
// The previous heuristic flagged any comment containing bare keywords like
// `IF`, `FOR`, `CASE`, `WHILE`, `VAR`, etc. — but those words turn up in
// English explanations too ("if we add a value", "use this in a CASE
// statement", "the VAR_OUTPUT lives there"). Prose comments that happen to
// mention an ST keyword were being false-flagged as "commented-out code".
//
// The tightened set matches only ST-shape patterns that are vanishingly rare
// in prose:
//   - `:=` and `=>` (assignment / output-binding operators)
//   - `END_X` block terminators (always closing a structured statement)
//   - `RETURN;` / `EXIT;` / `CONTINUE;` (control-transfer statements with
//     trailing semicolon)
//   - `IF ... THEN`, `FOR ... DO`, `WHILE ... DO`, `CASE ... OF` (full
//     control-flow shapes, not the bare keyword)
const ST_PATTERN = new RegExp(
  [
    ':=',
    '=>',
    '\\bEND_(IF|FOR|CASE|WHILE|REPEAT|VAR|FUNCTION|FUNCTION_BLOCK|PROGRAM|METHOD|NAMESPACE|INTERFACE|TYPE|STRUCT)\\b',
    '\\b(RETURN|EXIT|CONTINUE|GOTO)\\s*;',
    '\\bIF\\s+\\S.*\\sTHEN\\b',
    '\\bFOR\\s+\\w+\\s*:=',
    '\\bWHILE\\s+\\S.*\\sDO\\b',
    '\\bCASE\\s+\\w+\\s+OF\\b',
  ].join('|'),
);

function looksLikeCode(text: string): boolean {
  // Strip the comment markers.
  const stripped = text
    .replace(/^\(\*+/, '')
    .replace(/\*+\)$/, '')
    .replace(/^\/\/+/, '')
    .trim();
  if (stripped.length < 4) return false;
  // Too short to bother flagging; needs an assignment-like or control-keyword token to fire.
  return ST_PATTERN.test(stripped);
}

function key(c: CommentNode): string {
  return `${c.file}::${c.line}`;
}

export const commentedOutCode: Check = {
  category: 'COMMENTED_OUT_CODE',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set<string>();
    for (const c of ctx.before.comments) {
      if (looksLikeCode(c.text)) before.add(key(c));
    }
    for (const c of ctx.after.comments) {
      if (!looksLikeCode(c.text)) continue;
      if (before.has(key(c))) continue;
      findings.push({
        severity: 'info',
        category: 'COMMENTED_OUT_CODE',
        file: c.file,
        line: c.line,
        summary: 'Comment contains code-shaped content',
        detail:
          'Commented-out code rots fast. Either remove the block (git remembers it) or wrap it in a clearly-labeled `(* TODO: ... *)` if you really want to keep the snippet for later.',
      });
    }
    return findings;
  },
};
