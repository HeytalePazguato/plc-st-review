import { normalizeType, paramByName } from '../diff.js';
import type { CallSite, Check, Finding, Pou } from '../types.js';

export const callSiteOutdated: Check = {
  category: 'CALL_SITE_OUTDATED',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    // Build the lookup keys: by short name AND by qualified name.
    const pouByAnyName = new Map<string, Pou>();
    for (const p of ctx.after.pous.values()) {
      pouByAnyName.set(p.name.toLowerCase(), p);
      pouByAnyName.set(p.qualifiedName.toLowerCase(), p);
    }

    for (const cs of ctx.after.callSites) {
      const target = resolveCallee(cs.callee, pouByAnyName);
      if (!target) continue;

      const required = target.inputs.filter((p) => !p.initial);
      if (required.length === 0) continue;

      // Was the signature actually changed between before and after?
      const beforeTarget = ctx.before.pous.get(target.qualifiedName);
      const isNewlyRequired = isSignatureBreakingAdded(beforeTarget, target);

      const argMode = inferArgMode(cs);
      const missing: string[] = [];
      if (argMode === 'named') {
        for (const r of required) {
          if (!cs.namedArgs.has(r.name)) missing.push(r.name);
        }
      } else if (argMode === 'positional') {
        const allRequired = target.inputs.length;
        if (cs.positionalArgs.length < allRequired) {
          for (let i = cs.positionalArgs.length; i < allRequired; i++) {
            const p = target.inputs[i];
            if (p && !p.initial) missing.push(p.name);
          }
        }
      }

      // Type mismatches in named args.
      const typeIssues: string[] = [];
      for (const [argName, argText] of cs.namedArgs) {
        const param = paramByName(target.inputs, argName);
        if (!param) {
          typeIssues.push(`unknown argument '${argName}'`);
          continue;
        }
        // Best-effort: if the value text references a known global, verify type compat.
        const globalRef = ctx.after.globals.get(argText.trim());
        if (
          globalRef &&
          param.typeText &&
          normalizeType(globalRef.typeText) !== normalizeType(param.typeText)
        ) {
          typeIssues.push(
            `'${argName}' expects ${param.typeText} but got '${argText}' (${globalRef.typeText})`,
          );
        }
      }

      if (missing.length === 0 && typeIssues.length === 0) continue;

      const detailLines: string[] = [];
      if (missing.length) {
        detailLines.push(`Missing required arguments: ${missing.join(', ')}`);
      }
      for (const issue of typeIssues) detailLines.push(issue);
      if (isNewlyRequired) {
        detailLines.push(
          `Note: ${target.qualifiedName} gained a required argument between revisions.`,
        );
      }
      detailLines.push(`Callee defined at ${target.file}:${target.line}`);

      findings.push({
        severity: 'error',
        category: 'CALL_SITE_OUTDATED',
        file: cs.file,
        line: cs.line,
        summary: `Call to ${target.qualifiedName} is out of date with its signature`,
        detail: detailLines.join('\n'),
        related: [{ file: target.file, line: target.line, note: 'callee' }],
      });
    }
    return findings;
  },
};

function resolveCallee(
  callee: string,
  table: Map<string, Pou>,
): Pou | null {
  return (
    table.get(callee.toLowerCase()) ??
    table.get(callee.trim().toLowerCase()) ??
    null
  );
}

function inferArgMode(cs: CallSite): 'named' | 'positional' | 'empty' {
  if (cs.namedArgs.size > 0) return 'named';
  if (cs.positionalArgs.length > 0) return 'positional';
  return 'empty';
}

function isSignatureBreakingAdded(before: Pou | undefined, after: Pou): boolean {
  if (!before) return false;
  const beforeNames = new Set(before.inputs.map((p) => p.name.toLowerCase()));
  for (const p of after.inputs) {
    if (!beforeNames.has(p.name.toLowerCase()) && !p.initial) return true;
  }
  return false;
}
