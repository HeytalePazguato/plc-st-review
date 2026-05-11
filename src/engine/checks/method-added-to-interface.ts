import type { Check, Finding, Pou } from '../types.js';

function methodsOf(pou: Pou, allPous: Iterable<Pou>): string[] {
  const out: string[] = [];
  for (const candidate of allPous) {
    if (candidate.kind !== 'method') continue;
    if (candidate.parent !== pou.qualifiedName) continue;
    out.push(candidate.name);
  }
  return out;
}

export const methodAddedToInterface: Check = {
  category: 'METHOD_ADDED_TO_INTERFACE',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [qname, after] of ctx.after.pous) {
      if (after.kind !== 'interface') continue;
      const before = ctx.before.pous.get(qname);
      if (!before) continue;
      const beforeMethods = new Set(methodsOf(before, ctx.before.pous.values()));
      const afterMethods = methodsOf(after, ctx.after.pous.values());
      const added = afterMethods.filter((m) => !beforeMethods.has(m));
      if (added.length === 0) continue;

      const implementers = [...ctx.after.pous.values()].filter(
        (p) =>
          p.kind === 'function_block' &&
          p.implements.some((i) => i === after.qualifiedName || i === after.name),
      );
      for (const fb of implementers) {
        const fbMethods = new Set(methodsOf(fb, ctx.after.pous.values()));
        const missing = added.filter((m) => !fbMethods.has(m));
        if (missing.length === 0) continue;
        findings.push({
          severity: 'error',
          category: 'METHOD_ADDED_TO_INTERFACE',
          file: fb.file,
          line: fb.line,
          summary: `${fb.qualifiedName} does not implement new method(s) on ${after.qualifiedName}: ${missing.join(', ')}`,
          detail: `Interface ${after.qualifiedName} gained ${added.length} method(s) at ${after.file}:${after.line}. Implementing FBs must declare matching methods.`,
          related: [
            { file: after.file, line: after.line, note: 'interface definition' },
          ],
        });
      }
    }
    return findings;
  },
};
