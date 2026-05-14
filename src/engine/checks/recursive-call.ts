import type { CallSite, Check, Finding, SymbolTable } from '../types.js';

// The FB type that owns a given scope. `cs.scope` is the qualified POU name
// — for a top-level FB that's just its name; for a method it's `FB.Method`.
// Either way the owning FB type is the first segment.
function owningType(scope: string): string {
  return scope.includes('.') ? scope.split('.')[0] : scope;
}

function isSelfCall(cs: CallSite, t: SymbolTable): boolean {
  if (!cs.scope || cs.scope === '<file>') return false;
  const owner = owningType(cs.scope);
  const callee = cs.callee.toLowerCase();
  // Direct recursion by name: `FB_Foo()` inside FB_Foo (also covers the
  // function-recursion case where the callee is the function's own name).
  if (callee === owner.toLowerCase() || callee === cs.scope.toLowerCase()) {
    return true;
  }
  // Indirect recursion through a self-typed instance: `fbSelf()` where
  // `fbSelf : FB_Foo` is a local of FB_Foo. Resolve the callee to its
  // declared type via the per-POU locals catalogue.
  const locals = t.pouLocals.get(cs.scope) ?? [];
  const inst = locals.find((l) => l.name.toLowerCase() === callee);
  if (inst && inst.typeText.toLowerCase() === owner.toLowerCase()) {
    return true;
  }
  return false;
}

function key(cs: CallSite): string {
  return `${cs.file}::${cs.scope}::${cs.line}`;
}

export const recursiveCall: Check = {
  category: 'RECURSIVE_CALL',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const before = new Set(
      ctx.before.callSites.filter((cs) => isSelfCall(cs, ctx.before)).map(key),
    );
    for (const cs of ctx.after.callSites) {
      if (!isSelfCall(cs, ctx.after)) continue;
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
