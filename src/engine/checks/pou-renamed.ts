import { normalizeType } from '../diff.js';
import type { Check, Finding, Parameter, Pou } from '../types.js';

function signatureFingerprint(p: Pou): string {
  const slot = (param: Parameter): string => `${param.direction}:${normalizeType(param.typeText)}`;
  return [
    ...p.inputs.map(slot),
    ...p.outputs.map(slot),
    ...p.inOuts.map(slot),
  ].join('|');
}

export const pouRenamed: Check = {
  category: 'POU_RENAMED',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const deleted: Pou[] = [];
    const added: Pou[] = [];
    for (const [qname, b] of ctx.before.pous) {
      if (!ctx.after.pous.has(qname)) deleted.push(b);
    }
    for (const [qname, a] of ctx.after.pous) {
      if (!ctx.before.pous.has(qname)) added.push(a);
    }
    const usedAdded = new Set<string>();
    for (const d of deleted) {
      const dFp = signatureFingerprint(d);
      if (!dFp) continue; // can't match an empty signature
      const match = added.find(
        (a) =>
          a.kind === d.kind &&
          !usedAdded.has(a.qualifiedName) &&
          signatureFingerprint(a) === dFp,
      );
      if (!match) continue;
      usedAdded.add(match.qualifiedName);
      findings.push({
        severity: 'info',
        category: 'POU_RENAMED',
        file: match.file,
        line: match.line,
        summary: `Possible rename: ${d.qualifiedName} → ${match.qualifiedName}`,
        detail:
          'Both POUs share the same kind and signature (input/output/in-out names and types). ' +
          'If this was a rename, update all call sites; otherwise ignore.',
        related: [
          { file: d.file, line: d.line, note: 'previous name' },
        ],
      });
    }
    return findings;
  },
};
