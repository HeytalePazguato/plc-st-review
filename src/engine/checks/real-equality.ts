import { allChildrenOf, descendantsOfType, NODE } from '../grammar.js';
import type { Check, Finding } from '../types.js';

const COMP_OPS = new Set<string>(['=', '<>']);

function key(file: string, line: number): string {
  return `${file}::${line}`;
}

export const realEquality: Check = {
  category: 'REAL_EQUALITY',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];

    const findInRoot = (file: string, root: typeof ctx.pairs[number]['after']): Set<string> => {
      const out = new Set<string>();
      if (!root) return out;
      for (const be of descendantsOfType(root.root, NODE.BINARY_EXPRESSION)) {
        const ops = allChildrenOf(be).map((c) => c.type);
        if (!ops.some((t) => COMP_OPS.has(t))) continue;
        const hasReal = allChildrenOf(be).some((c) => c.type === NODE.REAL_LITERAL);
        if (hasReal) out.add(key(file, be.startPosition.row + 1));
      }
      return out;
    };

    for (const pair of ctx.pairs) {
      const beforeSet = findInRoot(pair.path, pair.before);
      const afterSet = findInRoot(pair.path, pair.after);
      for (const k of afterSet) {
        if (beforeSet.has(k)) continue;
        const [file, lineStr] = k.split('::');
        findings.push({
          severity: 'warn',
          category: 'REAL_EQUALITY',
          file,
          line: Number.parseInt(lineStr, 10),
          summary: 'Exact equality comparison against a REAL/LREAL literal',
          detail:
            'Floating-point arithmetic almost never produces the exact bit pattern of a literal. Compare against a tolerance band: `ABS(rValue - 0.5) < 1.0E-6` is reliable; `rValue = 0.5` is not.',
        });
      }
    }
    return findings;
  },
};
