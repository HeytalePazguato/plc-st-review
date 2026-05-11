import type { Check, Finding } from '../types.js';

export const pragmaChanged: Check = {
  category: 'PRAGMA_CHANGED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeByFile = new Map<string, Set<string>>();
    for (const p of ctx.before.pragmas) {
      const set = beforeByFile.get(p.file) ?? new Set<string>();
      set.add(p.text);
      beforeByFile.set(p.file, set);
    }
    const afterByFile = new Map<string, Set<string>>();
    for (const p of ctx.after.pragmas) {
      const set = afterByFile.get(p.file) ?? new Set<string>();
      set.add(p.text);
      afterByFile.set(p.file, set);
    }
    const files = new Set<string>([...beforeByFile.keys(), ...afterByFile.keys()]);
    for (const file of files) {
      const before = beforeByFile.get(file) ?? new Set<string>();
      const after = afterByFile.get(file) ?? new Set<string>();
      const added = [...after].filter((t) => !before.has(t));
      const removed = [...before].filter((t) => !after.has(t));
      if (added.length === 0 && removed.length === 0) continue;
      const lineHint =
        ctx.after.pragmas.find((p) => p.file === file)?.line ??
        ctx.before.pragmas.find((p) => p.file === file)?.line ??
        1;
      const detailLines: string[] = [];
      for (const a of added) detailLines.push(`  + ${a}`);
      for (const r of removed) detailLines.push(`  - ${r}`);
      findings.push({
        severity: 'info',
        category: 'PRAGMA_CHANGED',
        file,
        line: lineHint,
        summary: `Pragma(s) changed in ${file} (${added.length} added, ${removed.length} removed)`,
        detail: detailLines.join('\n'),
      });
    }
    return findings;
  },
};
