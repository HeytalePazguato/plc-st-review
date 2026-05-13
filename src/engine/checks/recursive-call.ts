import type { CallSite, Check, Finding } from '../types.js';

function isSelfCall(cs: CallSite): boolean {
  if (!cs.scope || cs.scope === '<file>') return false;
  const scopeName = cs.scope.includes('.') ? cs.scope.split('.').pop() ?? '' : cs.scope;
  return (
    cs.callee.toLowerCase() === scopeName.toLowerCase() ||
    cs.callee.toLowerCase() === cs.scope.toLowerCase()
  );
}

function key(cs: CallSite): string {
  return `${cs.file}::${cs.scope}::${cs.line}`;
}

export const recursiveCall: Check = {
  category: 'RECURSIVE_CALL',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(ctx.before.callSites.filter(isSelfCall).map(key));
    for (const cs of ctx.after.callSites) {
      if (!isSelfCall(cs)) continue;
      if (before.has(key(cs))) continue;
      findings.push({
        severity: 'warn',
        category: 'RECURSIVE_CALL',
        file: cs.file,
        line: cs.line,
        summary: `Recursive call: ${cs.scope} calls itself`,
        detail:
          'IEC 61131-3 implementations have a bounded stack; recursion risks overflow on any input that nests deeper than a few levels. Convert to iteration where possible.',
      });
    }
    return findings;
  },
};
