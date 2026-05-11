import { diffParams } from '../diff.js';
import type { Check, Finding, Pou } from '../types.js';

export const signatureChanged: Check = {
  category: 'SIGNATURE_CHANGED',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    for (const [qname, after] of ctx.after.pous) {
      const before = ctx.before.pous.get(qname);
      if (!before) continue;
      const inputs = diffParams(before.inputs, after.inputs);
      const outputs = diffParams(before.outputs, after.outputs);
      const inOuts = diffParams(before.inOuts, after.inOuts);

      const breaking =
        inputs.removed.length > 0 ||
        inputs.typeChanged.length > 0 ||
        outputs.removed.length > 0 ||
        outputs.typeChanged.length > 0 ||
        inOuts.removed.length > 0 ||
        inOuts.typeChanged.length > 0 ||
        (inputs.added.length > 0 && inputs.added.some((p) => !p.initial));

      const additive =
        !breaking &&
        (inputs.added.length > 0 ||
          outputs.added.length > 0 ||
          inOuts.added.length > 0);

      if (!breaking && !additive && inputs.initialChanged.length === 0) {
        continue;
      }

      findings.push({
        severity: breaking ? 'error' : 'warn',
        category: 'SIGNATURE_CHANGED',
        file: after.file,
        line: after.line,
        summary: formatSummary(after, inputs, outputs, inOuts, breaking),
        detail: formatDetail(before, after, inputs, outputs, inOuts),
      });
    }
    return findings;
  },
};

function formatSummary(
  after: Pou,
  inputs: ReturnType<typeof diffParams>,
  outputs: ReturnType<typeof diffParams>,
  inOuts: ReturnType<typeof diffParams>,
  breaking: boolean,
): string {
  const parts: string[] = [];
  if (inputs.added.length)
    parts.push(`+${inputs.added.length} input${plural(inputs.added.length)}`);
  if (inputs.removed.length)
    parts.push(`-${inputs.removed.length} input${plural(inputs.removed.length)}`);
  if (inputs.typeChanged.length)
    parts.push(`${inputs.typeChanged.length} input type change(s)`);
  if (outputs.added.length) parts.push(`+${outputs.added.length} output(s)`);
  if (outputs.removed.length) parts.push(`-${outputs.removed.length} output(s)`);
  if (inOuts.added.length) parts.push(`+${inOuts.added.length} in_out(s)`);
  if (inOuts.removed.length) parts.push(`-${inOuts.removed.length} in_out(s)`);
  const tag = breaking ? 'breaking' : 'additive';
  return `${after.kind} ${after.qualifiedName} signature changed (${tag}): ${parts.join(', ')}`;
}

function formatDetail(
  _before: Pou,
  _after: Pou,
  inputs: ReturnType<typeof diffParams>,
  outputs: ReturnType<typeof diffParams>,
  inOuts: ReturnType<typeof diffParams>,
): string {
  const lines: string[] = [];
  for (const a of inputs.added)
    lines.push(`  + VAR_INPUT ${a.name} : ${a.typeText}${a.initial ? ' := ' + a.initial : ''}`);
  for (const r of inputs.removed)
    lines.push(`  - VAR_INPUT ${r.name} : ${r.typeText}`);
  for (const c of inputs.typeChanged)
    lines.push(`  ~ VAR_INPUT ${c.name} : ${c.before.typeText} -> ${c.after.typeText}`);
  for (const a of outputs.added)
    lines.push(`  + VAR_OUTPUT ${a.name} : ${a.typeText}`);
  for (const r of outputs.removed)
    lines.push(`  - VAR_OUTPUT ${r.name} : ${r.typeText}`);
  for (const c of outputs.typeChanged)
    lines.push(`  ~ VAR_OUTPUT ${c.name} : ${c.before.typeText} -> ${c.after.typeText}`);
  for (const a of inOuts.added)
    lines.push(`  + VAR_IN_OUT ${a.name} : ${a.typeText}`);
  for (const r of inOuts.removed)
    lines.push(`  - VAR_IN_OUT ${r.name} : ${r.typeText}`);
  for (const c of inOuts.typeChanged)
    lines.push(`  ~ VAR_IN_OUT ${c.name} : ${c.before.typeText} -> ${c.after.typeText}`);
  return lines.join('\n');
}

function plural(n: number): string {
  return n === 1 ? '' : 's';
}
