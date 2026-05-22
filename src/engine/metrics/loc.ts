import { NODE, descendantsOfType } from '../grammar.js';
import type { StNode } from '../types.js';

export interface LocMetrics {
  /** Non-blank, non-comment-only lines in the POU span. */
  loc: number;
  /** Total lines in the POU span, including blanks and comments. */
  total: number;
  /** (lines touched by a comment / total) * 100. */
  commentRatio: number;
}

/**
 * Line metrics for a POU. Comment text is blanked out of the source before
 * counting, so a line carrying only a comment is excluded from `loc` while a
 * line with code plus a trailing comment still counts. Works off the AST's
 * comment nodes, so it follows whatever the grammar treats as a comment.
 */
export function locMetrics(pou: StNode, source: string): LocMetrics {
  const startRow = pou.startPosition.row;
  const endRow = pou.endPosition.row;
  const lines = source.split(/\r?\n/);
  const commentRows = new Set<number>();

  for (const comment of descendantsOfType(pou, NODE.COMMENT)) {
    const sr = comment.startPosition.row;
    const sc = comment.startPosition.column;
    const er = comment.endPosition.row;
    const ec = comment.endPosition.column;
    for (let r = sr; r <= er; r++) {
      commentRows.add(r);
      const line = lines[r] ?? '';
      const from = r === sr ? sc : 0;
      const to = r === er ? ec : line.length;
      const blank = ' '.repeat(Math.max(0, to - from));
      lines[r] = line.slice(0, from) + blank + line.slice(to);
    }
  }

  let loc = 0;
  let commentLines = 0;
  for (let r = startRow; r <= endRow; r++) {
    if ((lines[r] ?? '').trim() !== '') loc += 1;
    if (commentRows.has(r)) commentLines += 1;
  }

  const total = endRow - startRow + 1;
  const commentRatio = total > 0 ? (commentLines / total) * 100 : 0;
  return { loc, total, commentRatio };
}
