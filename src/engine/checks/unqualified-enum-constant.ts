import type { Check, EnumDef, Finding, SymbolTable } from '../types.js';

function memberIndex(t: SymbolTable): Map<string, EnumDef[]> {
  const out = new Map<string, EnumDef[]>();
  for (const e of t.enums.values()) {
    for (const v of e.values) {
      const k = v.name.toLowerCase();
      const list = out.get(k) ?? [];
      list.push(e);
      out.set(k, list);
    }
  }
  return out;
}

function key(file: string, line: number, name: string): string {
  return `${file}::${line}::${name.toLowerCase()}`;
}

export const unqualifiedEnumConstant: Check = {
  category: 'UNQUALIFIED_ENUM_CONSTANT',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const idx = memberIndex(ctx.after);
    // Build a fast lookup: which identifier names refer to enum members in a
    // CASE statement value? Those don't trigger this check — they're handled
    // by STATE_UNHANDLED / ENUM_VALUE_ADDED instead.
    const beforeIdx = memberIndex(ctx.before);
    const beforeBad = new Set<string>();
    for (const ref of ctx.before.varReferences) {
      const enums = beforeIdx.get(ref.name.toLowerCase());
      if (enums && enums.length > 0 && ref.scope !== '__global') {
        // Heuristic: the qualified form would be `EnumName.MEMBER`. If the
        // member access already exists at this exact line for one of the
        // enums, the unqualified ref is fine. Without that data we just
        // flag unqualified refs whose name uniquely matches an enum member.
        if (enums.length === 1) beforeBad.add(key(ref.file, ref.line, ref.name));
      }
    }
    for (const ref of ctx.after.varReferences) {
      const enums = idx.get(ref.name.toLowerCase());
      if (!enums || enums.length === 0) continue;
      if (enums.length > 1) continue; // ambiguous — different check might handle
      if (ref.scope === '__global') continue;
      const k = key(ref.file, ref.line, ref.name);
      if (beforeBad.has(k)) continue;
      // Filter out cases where the reference is the right-hand side of an
      // already-qualified member access (e.g. `E_State.IDLE` — the `IDLE`
      // identifier is also captured, but it's qualified). The member-access
      // walker produces a MemberAccess entry at the same line; treat that as
      // "already qualified".
      const isAlreadyQualified = ctx.after.memberAccesses.some(
        (m) =>
          m.file === ref.file &&
          m.line === ref.line &&
          m.rightText.trim().toLowerCase() === ref.name.toLowerCase(),
      );
      if (isAlreadyQualified) continue;
      const enumDef = enums[0];
      findings.push({
        severity: 'info',
        category: 'UNQUALIFIED_ENUM_CONSTANT',
        file: ref.file,
        line: ref.line,
        summary: `'${ref.name}' looks like an enum member; consider writing it qualified as ${enumDef.name}.${ref.name}`,
        detail:
          'Qualified enum references make the type obvious to anyone reading the code and let a future refactor of the enum surface every use.',
        related: [
          { file: enumDef.file, line: enumDef.line, note: `member of ${enumDef.name}` },
        ],
      });
    }
    return findings;
  },
};
