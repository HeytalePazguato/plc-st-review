import type { Check, Finding, MemberAccess, SymbolTable } from '../types.js';

function isUnknownMember(ref: MemberAccess, t: SymbolTable): boolean {
  const enumDef = t.enums.get(ref.leftText.trim());
  if (!enumDef) return false; // left side isn't a known enum, skip
  return !enumDef.values.some(
    (v) => v.name.toLowerCase() === ref.rightText.trim().toLowerCase(),
  );
}

function key(ref: MemberAccess): string {
  return `${ref.file}::${ref.leftText}.${ref.rightText}::${ref.line}`;
}

export const enumMemberUnknown: Check = {
  category: 'ENUM_MEMBER_UNKNOWN',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const ref of ctx.before.memberAccesses) {
      if (isUnknownMember(ref, ctx.before)) beforeBad.add(key(ref));
    }
    for (const ref of ctx.after.memberAccesses) {
      if (!isUnknownMember(ref, ctx.after)) continue;
      if (beforeBad.has(key(ref))) continue; // already broken; don't re-flag
      const enumDef = ctx.after.enums.get(ref.leftText.trim())!;
      const candidates = enumDef.values.map((v) => v.name);
      findings.push({
        severity: 'error',
        category: 'ENUM_MEMBER_UNKNOWN',
        file: ref.file,
        line: ref.line,
        summary: `Unknown enum member ${ref.leftText}.${ref.rightText}`,
        detail: `Enum ${ref.leftText} has values: ${candidates.join(', ')}. Likely typo.`,
        related: [
          { file: enumDef.file, line: enumDef.line, note: 'enum definition' },
        ],
      });
    }
    return findings;
  },
};
