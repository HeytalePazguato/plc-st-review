const MAX_PATTERN_LEN = 200;

/**
 * Conservative heuristic for "this user-supplied regex looks like a ReDoS
 * candidate." Detects the classic catastrophic-backtracking shape — a
 * quantifier inside a quantified group, e.g. `(a+)+`, `(\w+)*`, `(.*x)+` —
 * plus an outright pattern-length cap. Trades completeness for safety: a few
 * legitimate-but-unusual patterns may be rejected, but exponential-backtrack
 * patterns from an untrusted config can't sneak through.
 *
 * Patterns flagged here can almost always be rewritten without the nested
 * quantifier (anchor more strictly, use a non-overlapping alternation, switch
 * to bounded `{m,n}` with a small upper bound, etc.).
 */
export function isUnsafePattern(pat: string): boolean {
  if (pat.length > MAX_PATTERN_LEN) return true;

  // Strip escape sequences and bracket classes so that a literal `+` or a
  // character class containing `+` does not trip the nested-quantifier check.
  const s = pat
    .replace(/\\./g, '_')
    .replace(/\[[^\]]*\]/g, '_');

  // Per-group flag: has any unbounded quantifier (`+`, `*`, `{m,}`, `{m,300+}`)
  // been seen inside this group's body?
  const innerHasQuantifier: boolean[] = [false];

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') {
      innerHasQuantifier.push(false);
      continue;
    }
    if (c === ')') {
      const inner = innerHasQuantifier.pop() ?? false;
      const { quantified, skip } = quantifierAfter(s, i + 1);
      if (quantified && inner) return true;
      if (quantified && innerHasQuantifier.length > 0) {
        innerHasQuantifier[innerHasQuantifier.length - 1] = true;
      }
      i += skip;
      continue;
    }
    if (c === '+' || c === '*') {
      if (innerHasQuantifier.length > 0) {
        innerHasQuantifier[innerHasQuantifier.length - 1] = true;
      }
      continue;
    }
    if (c === '{') {
      const close = s.indexOf('}', i + 1);
      if (close > 0) {
        if (isUnboundedQuantifierBody(s.slice(i + 1, close))) {
          if (innerHasQuantifier.length > 0) {
            innerHasQuantifier[innerHasQuantifier.length - 1] = true;
          }
        }
        i = close;
        continue;
      }
    }
  }
  return false;
}

interface QuantifierMatch {
  quantified: boolean;
  skip: number; // characters past position `i+1` to advance over
}

function quantifierAfter(s: string, pos: number): QuantifierMatch {
  const c = s[pos];
  if (c === '*' || c === '+') return { quantified: true, skip: 0 };
  if (c === '{') {
    const close = s.indexOf('}', pos + 1);
    if (close > 0 && isUnboundedQuantifierBody(s.slice(pos + 1, close))) {
      return { quantified: true, skip: close - pos };
    }
  }
  return { quantified: false, skip: 0 };
}

function isUnboundedQuantifierBody(body: string): boolean {
  // Treat `{m,}` (open-ended) and `{m,N}` with N >= 100 as unbounded for
  // backtracking purposes. Bounded small-N forms are fine.
  if (/^\s*\d*\s*,\s*$/.test(body)) return true;
  const m = /^\s*\d*\s*,\s*(\d+)\s*$/.exec(body);
  if (m && Number(m[1]) >= 100) return true;
  return false;
}

/**
 * Validate and compile a user-supplied regex pattern. Returns `null` (and
 * writes a one-line warning to stderr) when the pattern is rejected by the
 * ReDoS guard or fails to compile. `source` is included in the warning so the
 * user can locate the bad rule.
 */
export function compileUserPattern(
  pat: string,
  source: string,
): RegExp | null {
  if (isUnsafePattern(pat)) {
    const preview = pat.length > 80 ? pat.slice(0, 80) + '...' : pat;
    process.stderr.write(
      `plc-st-review: rejecting unsafe regex from ${source}: ${preview} (length>${MAX_PATTERN_LEN} or nested quantifier)\n`,
    );
    return null;
  }
  try {
    return new RegExp(pat);
  } catch (err) {
    process.stderr.write(
      `plc-st-review: ignoring invalid regex from ${source}: ${pat} (${(err as Error).message})\n`,
    );
    return null;
  }
}
