import type { Check, Finding, NamedDecl } from '../types.js';

interface Collision {
  name: string;
  kinds: string[];      // sorted, unique
  locations: NamedDecl[];
}

function findCollisions(decls: readonly NamedDecl[]): Map<string, Collision> {
  // Group by case-folded name; report when more than one declaration kind
  // shares the same name (e.g. an enum value AND a global variable).
  const byName = new Map<string, NamedDecl[]>();
  for (const d of decls) {
    const k = d.name.toLowerCase();
    let arr = byName.get(k);
    if (!arr) {
      arr = [];
      byName.set(k, arr);
    }
    arr.push(d);
  }
  const out = new Map<string, Collision>();
  for (const [k, arr] of byName) {
    const kinds = Array.from(new Set(arr.map((d) => d.kind))).sort();
    if (kinds.length > 1) {
      out.set(k, { name: arr[0].name, kinds, locations: arr });
    }
  }
  return out;
}

function key(d: NamedDecl): string {
  return `${d.file}::${d.line}::${d.name.toLowerCase()}`;
}

export const nameReusedDifferentKind: Check = {
  category: 'NAME_REUSED_DIFFERENT_KIND',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const c of findCollisions(ctx.before.declarations).values()) {
      for (const d of c.locations) beforeBad.add(key(d));
    }
    const after = findCollisions(ctx.after.declarations);
    const reported = new Set<string>();
    for (const c of after.values()) {
      for (const d of c.locations) {
        if (beforeBad.has(key(d))) continue;
        // Dedupe one finding per (file, line) — multiple decls on one line
        // would otherwise spam.
        const pos = `${d.file}::${d.line}`;
        if (reported.has(pos)) continue;
        reported.add(pos);
        findings.push({
          severity: 'warn',
          category: 'NAME_REUSED_DIFFERENT_KIND',
          file: d.file,
          line: d.line,
          summary: `Name '${c.name}' is reused across kinds (${c.kinds.join(', ')}) — PLCopen N9`,
          detail:
            'PLCopen N9: different element kinds should not share a name. Reusing an identifier as e.g. both a global variable and an enum value confuses readers, hurts navigation tools, and silently changes meaning when scope visibility shifts. Rename one of them.',
        });
      }
    }
    return findings;
  },
};
