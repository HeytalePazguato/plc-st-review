import type { Check, Finding, Pou, SymbolTable } from '../types.js';

function countGlobalsUsed(p: Pou, t: SymbolTable): number {
  // A "global use" is a reference whose name resolves to a VAR_GLOBAL decl,
  // counted as a set of distinct global names referenced inside the POU
  // (so touching the same global five times still counts as one).
  //
  // Dedup key honours the dialect's case-sensitivity. In a case-insensitive
  // dialect (default; CODESYS / TwinCAT / generic IEC) `myGlobal` and
  // `MYGLOBAL` are the same global and should count as one — lowercase the
  // dedup key. In a case-sensitive dialect (B&R), they are distinct globals,
  // and the dedup must preserve case so the count matches the dialect's view.
  const used = new Set<string>();
  const dedupKey = (name: string): string =>
    t.caseSensitive ? name : name.toLowerCase();
  for (const ref of t.varReferences) {
    if (ref.file !== p.file) continue;
    if (ref.scope !== p.qualifiedName) continue;
    if (t.globals.has(ref.name)) used.add(dedupKey(ref.name));
  }
  return used.size;
}

function key(p: Pou): string {
  return `${p.file}::${p.qualifiedName}`;
}

export const tooManyGlobalsUsed: Check = {
  category: 'TOO_MANY_GLOBALS_USED',
  defaultSeverity: 'warn',
  run(ctx) {
    const cap = ctx.config.limits.maxGlobalsUsedPerPou;
    if (cap === null) return [];
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const p of ctx.before.pous.values()) {
      if (countGlobalsUsed(p, ctx.before) > cap) beforeBad.add(key(p));
    }
    for (const p of ctx.after.pous.values()) {
      const n = countGlobalsUsed(p, ctx.after);
      if (n <= cap) continue;
      if (beforeBad.has(key(p))) continue;
      findings.push({
        severity: 'warn',
        category: 'TOO_MANY_GLOBALS_USED',
        file: p.file,
        line: p.line,
        summary: `${p.kind} ${p.qualifiedName} references ${n} distinct globals (cap ${cap}) — PLCopen CP18`,
        detail:
          'PLCopen CP18: limit how much a single POU leans on global state. A POU that pulls from many globals is hard to test in isolation. Pass the values in through VAR_INPUT or wrap related globals in a STRUCT.',
      });
    }
    return findings;
  },
};
