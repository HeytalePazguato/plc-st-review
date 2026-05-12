import type { Check, Finding } from '../types.js';

export const enumValueRemoved: Check = {
  category: 'ENUM_VALUE_REMOVED',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [name, before] of ctx.before.enums) {
      const after = ctx.after.enums.get(name);
      if (!after) continue;
      const afterValues = new Set(after.values.map((v) => v.name));
      for (const v of before.values) {
        if (afterValues.has(v.name)) continue;
        // Find references to the removed value in the after CASE statements.
        const referencing = ctx.after.caseStatements.filter((cs) =>
          cs.values.some((cv) => cv.includes(v.name)),
        );
        if (referencing.length === 0) {
          findings.push({
            severity: 'warn',
            category: 'ENUM_VALUE_REMOVED',
            file: after.file,
            line: after.line,
            summary: `Enum value ${name}.${v.name} removed (no surviving references)`,
            detail:
              'No CASE statement in the new revision references this value, but downstream code may.',
          });
          continue;
        }
        for (const cs of referencing) {
          findings.push({
            severity: 'error',
            category: 'ENUM_VALUE_REMOVED',
            file: cs.file,
            line: cs.line,
            summary: `CASE references removed enum value ${name}.${v.name}`,
            detail: `${name}.${v.name} was removed from the enum at ${after.file}:${after.line} but is still referenced here.`,
            related: [
              { file: after.file, line: after.line, note: 'enum definition' },
            ],
          });
        }
      }
    }
    return findings;
  },
};
