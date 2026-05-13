import { descendantsOfAnyType, descendantsOfType, NODE } from '../grammar.js';
import type { Check, Finding, StNode } from '../types.js';

const CONDITIONAL_TYPES = new Set<string>([
  NODE.IF_STATEMENT,
  NODE.ELSIF_CLAUSE,
  NODE.WHILE_STATEMENT,
  NODE.REPEAT_STATEMENT,
]);

function key(file: string, line: number): string {
  return `${file}::${line}`;
}

function findInRoot(file: string, root: StNode | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!root) return out;
  for (const cond of descendantsOfAnyType(root, CONDITIONAL_TYPES)) {
    for (const asn of descendantsOfType(cond, NODE.ASSIGNMENT_STATEMENT)) {
      // Only flag assignments directly inside the condition expression — not
      // ones inside the body. Approximation: if the assignment's line is the
      // same as the conditional statement's line, it's in the condition.
      if (asn.startPosition.row === cond.startPosition.row) {
        out.add(key(file, cond.startPosition.row + 1));
      }
    }
  }
  return out;
}

export const assignmentInCondition: Check = {
  category: 'ASSIGNMENT_IN_CONDITION',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    for (const pair of ctx.pairs) {
      const before = findInRoot(pair.path, pair.before?.root ?? null);
      const after = findInRoot(pair.path, pair.after?.root ?? null);
      for (const k of after) {
        if (before.has(k)) continue;
        const [file, lineStr] = k.split('::');
        findings.push({
          severity: 'warn',
          category: 'ASSIGNMENT_IN_CONDITION',
          file,
          line: Number.parseInt(lineStr, 10),
          summary: 'Assignment (`:=`) used inside a conditional expression',
          detail:
            'IEC 61131-3 `IF x := y THEN` performs an assignment then tests the result. Almost always a typo for `IF x = y THEN`. Pull the assignment out above the condition.',
        });
      }
    }
    return findings;
  },
};
