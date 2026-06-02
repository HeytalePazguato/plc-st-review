import type { Check, Finding, RestrictedStatement } from '../types.js';

function key(s: RestrictedStatement): string {
  return `${s.file}::${s.line}::${s.kind}`;
}

export const forbiddenStatement: Check = {
  category: 'FORBIDDEN_STATEMENT',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(ctx.before.restrictedStatements.map(key));
    for (const s of ctx.after.restrictedStatements) {
      if (before.has(key(s))) continue;
      findings.push({
        severity: 'info',
        category: 'FORBIDDEN_STATEMENT',
        file: s.file,
        line: s.line,
        summary: `${s.kind} statement used (PLCopen L10)`,
        detail:
          'PLCopen L10: avoid `EXIT`, `CONTINUE`, and `GOTO`. They jump out of the structured-control flow and make iteration / branching hard to reason about. Restructure the loop or condition so the natural fall-through gets you where you want.',
      });
    }
    return findings;
  },
};
