import type { Check, Finding } from '../types.js';

/**
 * STATE_UNHANDLED. A `CASE` on an enum has no ELSE branch and does not cover
 * every enum value that exists in the new revision. Unlike ENUM_VALUE_ADDED,
 * which fires only when the enum gained a value, this check also fires for
 * pre-existing gaps: if your enum has five states and you only switch on three,
 * you'll hear about it.
 */
export const stateUnhandled: Check = {
  category: 'STATE_UNHANDLED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    for (const cs of ctx.after.caseStatements) {
      if (cs.hasElse) continue;
      // Try to match the switch expression to a known enum by suffix.
      const enumMatch = [...ctx.after.enums.values()].find((e) => {
        if (!cs.enumName) return false;
        return (
          cs.enumName.toLowerCase() === e.name.toLowerCase() ||
          cs.values.some((v) => v.toLowerCase().startsWith(e.name.toLowerCase() + '.'))
        );
      });
      if (!enumMatch) continue;
      const referenced = new Set(
        cs.values.map((v) => stripQualifier(v, enumMatch.name).toLowerCase()),
      );
      const missing = enumMatch.values
        .filter((v) => !referenced.has(v.name.toLowerCase()))
        .map((v) => v.name);
      if (missing.length === 0) continue;
      findings.push({
        severity: 'info',
        category: 'STATE_UNHANDLED',
        file: cs.file,
        line: cs.line,
        summary: `CASE on ${enumMatch.name} is missing branches for ${missing.length} value(s) and has no ELSE`,
        detail: `Unhandled: ${missing.map((m) => `${enumMatch.name}.${m}`).join(', ')}`,
        related: [
          { file: enumMatch.file, line: enumMatch.line, note: 'enum definition' },
        ],
      });
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
