import type { Check, Finding } from '../types.js';

function key(file: string, line: number, callee: string): string {
  return `${file}::${line}::${callee.toLowerCase()}`;
}

export const unusedReturnValue: Check = {
  category: 'UNUSED_RETURN_VALUE',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    // An invocation_statement whose callee is a function POU (not an FB
    // instance, not a method) discards the return value by definition.
    const isFunctionPou = (callee: string): boolean => {
      const p = ctx.after.pous.get(callee) ?? ctx.after.pous.get(callee.trim());
      return !!p && p.kind === 'function' && !!p.returnType;
    };
    const before = new Set<string>();
    for (const cs of ctx.before.callSites) {
      if (isFunctionPou(cs.callee)) before.add(key(cs.file, cs.line, cs.callee));
    }
    for (const cs of ctx.after.callSites) {
      if (!isFunctionPou(cs.callee)) continue;
      if (before.has(key(cs.file, cs.line, cs.callee))) continue;
      const fn = ctx.after.pous.get(cs.callee) ?? ctx.after.pous.get(cs.callee.trim());
      findings.push({
        severity: 'info',
        category: 'UNUSED_RETURN_VALUE',
        file: cs.file,
        line: cs.line,
        summary: `Return value of ${cs.callee}() (declared ${fn?.returnType ?? 'typed'}) is discarded`,
        detail:
          'Calling a function as a bare statement throws away its result. Assign it to a variable or use the value in an expression.',
      });
    }
    return findings;
  },
};
