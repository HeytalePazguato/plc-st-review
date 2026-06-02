import type { Check, Finding } from '../types.js';

export const enumValueRemoved: Check = {
  category: 'ENUM_VALUE_REMOVED',
  defaultSeverity: 'error',
  run(ctx) {
    const cs = ctx.config.caseSensitive;
    const norm = (s: string): string => (cs ? s : s.toLowerCase());

    const findings: Finding[] = [];
    for (const [enumName, before] of ctx.before.enums) {
      const after = ctx.after.enums.get(enumName);
      if (!after) continue;
      // Use normalized keys so a value renamed in case only (e.g. `idle` ->
      // `IDLE`) is not reported as removed under a case-insensitive dialect.
      const afterValues = new Set(after.values.map((v) => norm(v.name)));
      for (const v of before.values) {
        if (afterValues.has(norm(v.name))) continue;

        // A CASE arm references value V of enum E iff the arm's text is
        // exactly `V` (bare) or `E.V` (qualified) — *not* any substring match.
        // The old `.includes(v.name)` matched e.g. `EMERGENCY_STOP` for a
        // removed `STOP`, producing both false positives and wrong attribution.
        const targets = new Set<string>([
          norm(v.name),
          norm(`${enumName}.${v.name}`),
        ]);
        const armMatches = (raw: string): boolean =>
          raw.split(',').some((token) => targets.has(norm(token.trim())));

        const referencing = ctx.after.caseStatements.filter((cs2) =>
          cs2.values.some(armMatches),
        );
        if (referencing.length === 0) {
          findings.push({
            severity: 'warn',
            category: 'ENUM_VALUE_REMOVED',
            file: after.file,
            line: after.line,
            summary: `Enum value ${enumName}.${v.name} removed (no surviving references)`,
            detail:
              'No CASE statement in the new revision references this value, but downstream code may.',
          });
          continue;
        }
        for (const cs2 of referencing) {
          findings.push({
            severity: 'error',
            category: 'ENUM_VALUE_REMOVED',
            file: cs2.file,
            line: cs2.line,
            summary: `CASE references removed enum value ${enumName}.${v.name}`,
            detail: `${enumName}.${v.name} was removed from the enum at ${after.file}:${after.line} but is still referenced here.`,
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
