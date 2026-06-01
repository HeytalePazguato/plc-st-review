import type {
  Check,
  Finding,
  Parameter,
  SymbolTable,
} from '../types.js';

// IEC 62443-4-2 CR 3.5 (input validation): the component shall validate the
// syntax and content of any input that is used as a process-control input or
// that directly impacts the action of the component. In ST, the static
// approximation is: a `VAR_INPUT` reaches a privileged operation (array
// subscript, divisor) in the same POU without being guarded by a
// relational comparison (`< > <= >= = <>`) anywhere in that POU.
//
// This is a heuristic. False positives include inputs validated in a *caller*
// POU before invocation; integrators who want that guarantee should still
// add an in-POU guard so the validation is locally evident — which is exactly
// the secure-coding posture 62443 is asking for.

const RELATIONAL_OPS = new Set<string>(['<', '>', '<=', '>=', '=', '<>']);

interface SensitiveUse {
  inputName: string;
  scope: string;
  file: string;
  line: number;
  kind: 'array_index' | 'divisor';
}

function collectSensitiveUses(
  t: SymbolTable,
  inputsByScope: Map<string, Parameter[]>,
): SensitiveUse[] {
  const out: SensitiveUse[] = [];
  for (const access of t.arrayAccesses) {
    const inputs = inputsByScope.get(access.scope);
    if (!inputs) continue;
    const match = inputs.find(
      (p) => p.name.toLowerCase() === access.indexText.toLowerCase(),
    );
    if (match) {
      out.push({
        inputName: match.name,
        scope: access.scope,
        file: access.file,
        line: access.line,
        kind: 'array_index',
      });
    }
  }
  for (const div of t.divisions) {
    const inputs = inputsByScope.get(div.scope);
    if (!inputs) continue;
    const match = inputs.find(
      (p) => p.name.toLowerCase() === div.divisorText.toLowerCase(),
    );
    if (match) {
      out.push({
        inputName: match.name,
        scope: div.scope,
        file: div.file,
        line: div.line,
        kind: 'divisor',
      });
    }
  }
  return out;
}

/**
 * Names that appear on either side of a relational operator anywhere in the
 * given scope. A `VAR_INPUT` whose name lands here has been compared against
 * something — the engine accepts that as a "guard exists" signal.
 *
 * This is a coarse approximation: a comparison that follows the dangerous use
 * (lexically below it in the source) is treated the same as one that precedes
 * it, because order of evaluation depends on control flow we don't model. The
 * trade-off favours fewer false positives; integrators who want stricter
 * "compared *before* use" checking will see the same finding when they read
 * the POU body.
 */
function guardedNamesByScope(t: SymbolTable): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const be of t.binaryExpressions) {
    if (!RELATIONAL_OPS.has(be.op)) continue;
    let set = out.get(be.scope);
    if (!set) {
      set = new Set();
      out.set(be.scope, set);
    }
    // Take the leading identifier (`a + 1 < b` → `a` and `b`); leave compound
    // tokens (member access, calls) intact so a guard on `state.value` still
    // matches a use of `state.value`.
    for (const side of [be.leftText, be.rightText]) {
      const head = side.trim().split(/[\s+\-*/(]/)[0];
      if (head) set.add(head.toLowerCase());
    }
  }
  return out;
}

function buildInputsByScope(t: SymbolTable): Map<string, Parameter[]> {
  const out = new Map<string, Parameter[]>();
  for (const p of t.pous.values()) {
    if (p.inputs.length === 0) continue;
    out.set(p.qualifiedName, p.inputs);
  }
  return out;
}

export const unvalidatedInputUse: Check = {
  category: 'UNVALIDATED_INPUT_USE',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    const beforeInputs = buildInputsByScope(ctx.before);
    const beforeGuards = guardedNamesByScope(ctx.before);
    for (const use of collectSensitiveUses(ctx.before, beforeInputs)) {
      const guarded = beforeGuards.get(use.scope);
      if (guarded?.has(use.inputName.toLowerCase())) continue;
      beforeBad.add(`${use.file}::${use.line}::${use.inputName.toLowerCase()}`);
    }

    const afterInputs = buildInputsByScope(ctx.after);
    const afterGuards = guardedNamesByScope(ctx.after);
    const seen = new Set<string>();
    for (const use of collectSensitiveUses(ctx.after, afterInputs)) {
      const guarded = afterGuards.get(use.scope);
      if (guarded?.has(use.inputName.toLowerCase())) continue;
      const k = `${use.file}::${use.line}::${use.inputName.toLowerCase()}`;
      if (beforeBad.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      const kindLabel =
        use.kind === 'array_index' ? 'array subscript' : 'divisor';
      findings.push({
        severity: 'info',
        category: 'UNVALIDATED_INPUT_USE',
        file: use.file,
        line: use.line,
        summary: `VAR_INPUT '${use.inputName}' used as ${kindLabel} without an in-POU guard (IEC 62443-4-2 CR 3.5)`,
        detail:
          'IEC 62443-4-2 CR 3.5: inputs used as process-control inputs (or that directly impact the component\'s action) shall be validated. The engine sees no relational comparison on this input anywhere in the POU body — meaning a caller passing an out-of-range value lands directly in an array subscript or divisor. Add a bounds check before the use (e.g. `IF inputName > 0 AND inputName <= MAX THEN`) so the validation is locally evident, even if a caller already validates upstream.',
      });
    }
    return findings;
  },
};
