import type { Check, Finding, NamedDecl, SymbolTable } from '../types.js';

function inputVarsInScope(scope: string, t: SymbolTable): NamedDecl[] {
  return t.declarations.filter((d) => d.kind === 'var_input' && d.scope === scope);
}

function key(file: string, line: number, name: string): string {
  return `${file}::${line}::${name.toLowerCase()}`;
}

export const inputVarWritten: Check = {
  category: 'INPUT_VAR_WRITTEN',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const tgt of ctx.before.assignmentTargets) {
      const inputs = inputVarsInScope(tgt.scope, ctx.before);
      if (inputs.some((i) => i.name.toLowerCase() === tgt.name.toLowerCase())) {
        beforeBad.add(key(tgt.file, tgt.line, tgt.name));
      }
    }
    for (const tgt of ctx.after.assignmentTargets) {
      const inputs = inputVarsInScope(tgt.scope, ctx.after);
      const match = inputs.find((i) => i.name.toLowerCase() === tgt.name.toLowerCase());
      if (!match) continue;
      if (beforeBad.has(key(tgt.file, tgt.line, tgt.name))) continue;
      findings.push({
        severity: 'warn',
        category: 'INPUT_VAR_WRITTEN',
        file: tgt.file,
        line: tgt.line,
        summary: `VAR_INPUT ${match.name} is being assigned inside ${tgt.scope}`,
        detail:
          'Writing to an input variable hides changes from the caller and breaks the input-output contract. Use a local variable instead.',
        related: [{ file: match.file, line: match.line, note: 'input declaration' }],
      });
    }
    return findings;
  },
};
