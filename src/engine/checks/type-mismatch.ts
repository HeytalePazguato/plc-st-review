import { normalizeType } from '../diff.js';
import type { Check, Finding, VarReference } from '../types.js';

export const typeMismatch: Check = {
  category: 'TYPE_MISMATCH',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [name, after] of ctx.after.globals) {
      const before = ctx.before.globals.get(name);
      if (!before) continue;
      if (normalizeType(before.typeText) === normalizeType(after.typeText)) continue;

      const refs = ctx.after.varReferences
        .filter((r: VarReference) => r.name === name && r.file !== after.file)
        .reduce<Map<string, number>>((acc, r) => {
          acc.set(r.file, (acc.get(r.file) ?? 0) + 1);
          return acc;
        }, new Map());

      const related = [...refs.entries()].map(([f, n]) => ({
        file: f,
        line: 1,
        note: `${n} reference${n === 1 ? '' : 's'}`,
      }));

      findings.push({
        severity: 'error',
        category: 'TYPE_MISMATCH',
        file: after.file,
        line: after.line,
        summary: `Global '${name}' type changed: ${before.typeText} → ${after.typeText}`,
        detail:
          related.length === 0
            ? 'No other files reference this global in the new revision.'
            : `Callers in ${related.length} file${related.length === 1 ? '' : 's'} may need updating.`,
        related,
      });
    }
    return findings;
  },
};
