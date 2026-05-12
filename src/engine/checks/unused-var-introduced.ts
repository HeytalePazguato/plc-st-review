import type { Check, Finding, LocalVar } from '../types.js';

export const unusedVarIntroduced: Check = {
  category: 'UNUSED_VAR_INTRODUCED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [scope, locals] of ctx.after.pouLocals) {
      const beforeLocals = new Set(
        (ctx.before.pouLocals.get(scope) ?? []).map((l) => l.name.toLowerCase()),
      );
      const newLocals = locals.filter((l) => !beforeLocals.has(l.name.toLowerCase()));
      if (newLocals.length === 0) continue;
      // Build a quick lookup of references in this scope's file.
      const fileRefs = new Map<string, number>(); // name -> count
      for (const ref of ctx.after.varReferences) {
        if (ref.file !== (newLocals[0] as LocalVar).file) continue;
        const k = ref.name.toLowerCase();
        fileRefs.set(k, (fileRefs.get(k) ?? 0) + 1);
      }
      for (const v of newLocals) {
        // Each declaration itself contributes one identifier ref. Treat anything
        // less than 2 as unused.
        const count = fileRefs.get(v.name.toLowerCase()) ?? 0;
        if (count >= 2) continue;
        findings.push({
          severity: 'info',
          category: 'UNUSED_VAR_INTRODUCED',
          file: v.file,
          line: v.line,
          summary: `Variable ${v.name} introduced in ${scope} but not referenced`,
          detail: 'Either remove the declaration or add a use of it.',
        });
      }
    }
    return findings;
  },
};
