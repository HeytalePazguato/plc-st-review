/**
 * Parse an IEC 61131-3 numeric literal to a JS number, or `null` when the text
 * is not a recognizable numeric literal.
 *
 * `Number.parseFloat` silently mangles several legal ST literal forms — it
 * reads `16#FF` as `16`, `1_000` as `1`, and `2#1010` as `2` — which turns
 * value-comparing checks (array bounds, divisor==0, counter PV==0, loop
 * bounds) into false negatives/positives. This helper handles:
 *
 *   - decimal ints / reals, optionally signed: `42`, `-7`, `3.14`, `1.0e6`
 *   - digit-group separators: `1_000`, `16#FF_FF`
 *   - based (radix) literals, base 2..36: `2#1010`, `8#17`, `16#FF`
 *   - typed literals (prefix stripped): `INT#42`, `UINT#16#FF`, `WORD#16#A0`
 *
 * Non-numeric literals (identifiers, `TRUE`/`FALSE`, `T#5s` time literals,
 * strings) return `null`.
 */
export function parseStNumber(raw: string): number | null {
  let t = raw.trim();
  if (t === '') return null;

  let sign = 1;
  if (t.startsWith('-')) {
    sign = -1;
    t = t.slice(1).trimStart();
  } else if (t.startsWith('+')) {
    t = t.slice(1).trimStart();
  }

  const hash = t.indexOf('#');
  if (hash > 0) {
    const left = t.slice(0, hash);
    const right = t.slice(hash + 1);
    if (/^[0-9]+$/.test(left)) {
      // Based literal: <base>#<digits>.
      const base = Number.parseInt(left, 10);
      if (base < 2 || base > 36) return null;
      const digits = right.replace(/_/g, '');
      if (digits === '' || !digitsValidInBase(digits, base)) return null;
      const v = Number.parseInt(digits, base);
      return Number.isNaN(v) ? null : sign * v;
    }
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(left)) {
      // Typed literal: <TYPE>#<value>. Strip the type and parse the remainder,
      // which may itself be decimal or based (e.g. UINT#16#FF).
      const inner = parseStNumber(right);
      return inner === null ? null : sign * inner;
    }
    return null;
  }

  // Plain decimal / real, with optional digit-group separators and exponent.
  const cleaned = t.replace(/_/g, '');
  if (!/^[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? sign * n : null;
}

function digitsValidInBase(digits: string, base: number): boolean {
  for (const ch of digits.toLowerCase()) {
    const d =
      ch >= '0' && ch <= '9'
        ? ch.charCodeAt(0) - 48
        : ch >= 'a' && ch <= 'z'
          ? ch.charCodeAt(0) - 87
          : 99;
    if (d >= base) return false;
  }
  return true;
}
