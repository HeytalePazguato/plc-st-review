import { allChildrenOf, descendantsOfType, NODE } from '../grammar.js';
import type { Check, Finding } from '../types.js';

const COMP_OPS = new Set<string>(['=', '<>']);

function key(file: string, line: number): string {
  return `${file}::${line}`;
}

export const boolComparison: Check = {
  category: 'BOOL_COMPARISON',
  defaultSeverity: 'info',
  run(ctx) {
    const findings: Finding[] = [];
    const findInPair = (pair: typeof ctx.pairs[number]): Set<string> => {
      const out = new Set<string>();
      if (!pair) return out;
      const file = pair.path;
      for (const f of [pair.before, pair.after]) {
        if (!f) continue;
        for (const be of descendantsOfType(f.root, NODE.BINARY_EXPRESSION)) {
          // Detect comparison op.
          const opTokens = allChildrenOf(be).map((c) => c.type);
          const hasComp = opTokens.some((t) => COMP_OPS.has(t));
          if (!hasComp) continue;
          // Either side a boolean literal?
          const hasBool = allChildrenOf(be).some(
            (c) => c.type === NODE.BOOLEAN_LITERAL,
          );
          if (hasBool) {
            out.add(key(file, be.startPosition.row + 1));
          }
        }
      }
      return out;
    };

    for (const pair of ctx.pairs) {
      const beforeSet = pair.before
        ? findInPair({ ...pair, after: null })
        : new Set<string>();
      const afterSet = pair.after
        ? findInPair({ ...pair, before: null })
        : new Set<string>();
      for (const k of afterSet) {
        if (beforeSet.has(k)) continue;
        const [file, lineStr] = k.split('::');
        findings.push({
          severity: 'info',
          category: 'BOOL_COMPARISON',
          file,
          line: Number.parseInt(lineStr, 10),
          summary: 'Comparison against a boolean literal (e.g. `IF b = TRUE`)',
          detail:
            'A BOOL variable is already true/false. `IF b` and `IF NOT b` are clearer than `IF b = TRUE` / `IF b = FALSE`.',
        });
      }
    }
    return findings;
  },
};
