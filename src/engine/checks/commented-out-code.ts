import type { Check, CommentNode, Finding } from '../types.js';

const ST_PATTERN = /(:=|=>)|\b(IF|END_IF|FOR|END_FOR|CASE|END_CASE|WHILE|END_WHILE|FUNCTION_BLOCK|END_FUNCTION_BLOCK|VAR|END_VAR|PROGRAM|END_PROGRAM|RETURN|EXIT)\b/;

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
