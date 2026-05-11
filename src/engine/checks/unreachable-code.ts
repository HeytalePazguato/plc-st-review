import type { Check, Finding, UnreachableStmt } from '../types.js';

const REASON_TEXT: Record<UnreachableStmt['reason'], string> = {
  after_return: 'after RETURN',
  after_exit: 'after EXIT',
  after_continue: 'after CONTINUE',
};

export const unreachableCode: Check = {
  category: 'UNREACHABLE_CODE',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    // We only care about unreachable code introduced in the new revision,
    // i.e. statements unreachable in `after` that weren't already in `before`.
    const beforeSet = new Set(
      ctx.before.unreachable.map((u) => `${u.file}::${u.scope}::${u.line}`),
    );
    for (const u of ctx.after.unreachable) {
      const k = `${u.file}::${u.scope}::${u.line}`;
      if (beforeSet.has(k)) continue;
      findings.push({
        severity: 'warn',
        category: 'UNREACHABLE_CODE',
        file: u.file,
        line: u.line,
        summary: `Unreachable statement ${REASON_TEXT[u.reason]}`,
        detail: `In scope ${u.scope}. Either remove the statement or move the terminator after it.`,
      });
    }
    return findings;
  },
};
