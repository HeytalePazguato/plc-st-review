import type { Check, Finding } from '../types.js';

export const pouDeleted: Check = {
  category: 'POU_DELETED',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [qname, before] of ctx.before.pous) {
      if (ctx.after.pous.has(qname)) continue;
      // Find callers in the after-snapshot that still reference this name.
      const callers = ctx.after.callSites.filter(
        (cs) =>
          cs.callee === before.name ||
          cs.callee === before.qualifiedName ||
          cs.callee.endsWith('.' + before.name),
      );
      if (callers.length === 0) {
        findings.push({
          severity: 'warn',
          category: 'POU_DELETED',
          file: before.file,
          line: before.line,
          summary: `${before.kind} ${before.qualifiedName} deleted (no surviving callers)`,
          detail:
            'Confirm downstream projects do not depend on this POU. No call sites in the new revision reference it.',
        });
        continue;
      }
      for (const c of callers) {
        findings.push({
          severity: 'error',
          category: 'POU_DELETED',
          file: c.file,
          line: c.line,
          summary: `Call to deleted ${before.kind} ${before.qualifiedName}`,
          detail: `${before.qualifiedName} no longer exists in the new revision.`,
          related: [
            { file: before.file, line: before.line, note: 'previous definition' },
          ],
        });
      }
    }
    return findings;
  },
};
