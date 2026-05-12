import type { Check, Finding } from '../types.js';

export const enumValueAdded: Check = {
  category: 'ENUM_VALUE_ADDED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [name, after] of ctx.after.enums) {
      const before = ctx.before.enums.get(name);
      if (!before) continue;
      const beforeValues = new Set(before.values.map((v) => v.name));
      const added = after.values.filter((v) => !beforeValues.has(v.name));
      if (added.length === 0) continue;

      const cases = ctx.after.caseStatements.filter((cs) => {
        if (!cs.enumName) return false;
        return cs.enumName.toLowerCase().includes(name.toLowerCase()) ||
          cs.values.some((cv) => cv.startsWith(`${name}.`));
      });

      for (const cs of cases) {
        if (cs.hasElse) continue;
        const referenced = new Set(cs.values.map((v) => stripQualifier(v, name)));
        const missing = added.filter((a) => !referenced.has(a.name));
        if (missing.length === 0) continue;
        findings.push({
          severity: 'warn',
          category: 'ENUM_VALUE_ADDED',
          file: cs.file,
          line: cs.line,
          summary: `CASE does not handle new enum value(s): ${missing.map((m) => `${name}.${m.name}`).join(', ')}`,
          detail: `Enum ${name} gained ${added.length} value(s) at ${after.file}:${after.line} and this CASE has no ELSE branch.`,
          related: [
            { file: after.file, line: after.line, note: 'enum definition' },
          ],
        });
      }
    }
    return findings;
  },
};

function stripQualifier(value: string, enumName: string): string {
  const t = value.trim();
  if (t.toLowerCase().startsWith(enumName.toLowerCase() + '.')) {
    return t.slice(enumName.length + 1);
  }
  return t;
}
