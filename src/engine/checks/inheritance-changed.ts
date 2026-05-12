import type { Check, Finding } from '../types.js';

export const inheritanceChanged: Check = {
  category: 'INHERITANCE_CHANGED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [qname, after] of ctx.after.pous) {
      if (after.kind !== 'function_block' && after.kind !== 'method') continue;
      const before = ctx.before.pous.get(qname);
      if (!before) continue;
      const b = before.extends ?? '';
      const a = after.extends ?? '';
      if (b === a) continue;
      const verb = !b && a ? 'added' : b && !a ? 'removed' : 'changed';
      findings.push({
        severity: 'warn',
        category: 'INHERITANCE_CHANGED',
        file: after.file,
        line: after.line,
        summary: `${after.qualifiedName} EXTENDS clause ${verb}: ${b || '<none>'} → ${a || '<none>'}`,
        detail:
          'Derived behavior may have changed. Verify that the new base provides the expected methods and that overrides still apply correctly.',
      });
    }
    return findings;
  },
};
