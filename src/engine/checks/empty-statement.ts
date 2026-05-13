import type { Check, EmptyStmt, Finding } from '../types.js';

function key(e: EmptyStmt): string {
  return `${e.file}::${e.line}`;
}

export const emptyStatement: Check = {
  category: 'EMPTY_STATEMENT',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(ctx.before.emptyStatements.map(key));
    for (const e of ctx.after.emptyStatements) {
      if (before.has(key(e))) continue;
      findings.push({
        severity: 'info',
        category: 'EMPTY_STATEMENT',
        file: e.file,
        line: e.line,
        summary: 'Empty statement (lone `;`)',
        detail:
          'An empty statement does nothing. Either remove it or replace it with an explicit comment if the position is intentional.',
      });
    }
    return findings;
  },
};
