import type { Check, Finding, GlobalVar, LocalVar } from '../types.js';

// IEC 62443-4-1 SI-1 / 62443-4-2 CR 1.5: stored credentials shall not be
// hard-coded into the component. A literal password/secret/token initialised
// in source is a classic finding in industrial code reviews — the credential
// ends up in version control, in build artifacts, and in every backup forever.
const SECRET_NAME_PATTERNS: readonly RegExp[] = [
  /password/i,
  /passwd/i,
  /\bpwd\b/i,
  /secret/i,
  /api[_-]?key/i,
  /api[_-]?token/i,
  /credential/i,
  /\bcred\b/i,
  /private[_-]?key/i,
  /\bsshkey\b/i,
];

// Conservative placeholders we don't flag — the developer is signalling "to be
// filled in by the integrator" and a finding here is noise.
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^$/,
  /^\s+$/,
  /^<.*>$/, // <password>, <CHANGE_ME>
  /^\*+$/,  // ****
  /^x+$/i,  // xxxxx
  /^changeme$/i,
  /^todo$/i,
  /^placeholder$/i,
];

const STRING_TYPES = new Set<string>(['STRING', 'WSTRING']);

function isSecretName(name: string): boolean {
  for (const pat of SECRET_NAME_PATTERNS) if (pat.test(name)) return true;
  return false;
}

function isStringType(typeText: string): boolean {
  // Strip any `STRING[80]` length suffix; also handle the leading TYPE# prefix
  // that some grammars surface (rare but possible).
  const head = typeText.trim().toUpperCase().split(/[\s\[]/)[0];
  return STRING_TYPES.has(head);
}

function literalValue(initial: string | undefined): string | null {
  if (!initial) return null;
  // ST string literals quote with `'` (STRING) or `"` (WSTRING). Strip exactly
  // one outer pair; leave the inner text as-is.
  const trimmed = initial.trim();
  if (
    (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
  ) {
    return trimmed.slice(1, -1);
  }
  // Non-quoted initial (e.g. a constant reference) — we don't know the value.
  return null;
}

function isPlaceholder(value: string): boolean {
  for (const pat of PLACEHOLDER_PATTERNS) if (pat.test(value)) return true;
  return false;
}

function flag(
  decl: GlobalVar | (LocalVar & { kind: string }),
): Finding | null {
  if (!isSecretName(decl.name) || !isStringType(decl.typeText)) return null;
  const value = literalValue(decl.initial);
  if (value === null || isPlaceholder(value)) return null;
  return {
    severity: 'error',
    category: 'HARDCODED_CREDENTIALS',
    file: decl.file,
    line: decl.line,
    summary: `Hard-coded credential in '${decl.name}' (IEC 62443-4-2 CR 1.5)`,
    detail:
      "IEC 62443-4-1 SI-1 and 62443-4-2 CR 1.5: credentials shall not be hard-coded. The literal initialiser commits the secret to version control, build artifacts, and every backup — anyone with read access has the credential. Replace with a runtime read from a configuration store, a fieldbus parameter, or a key-management facility, and rotate the leaked value.",
  };
}

export const hardcodedCredentials: Check = {
  category: 'HARDCODED_CREDENTIALS',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    // Globals first.
    const seen = new Set<string>();
    for (const g of ctx.after.globalDecls) {
      const f = flag(g);
      if (!f) continue;
      const k = `${f.file}::${f.line}::${g.name.toLowerCase()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      findings.push(f);
    }
    // Locals (incl. constants declared inside POUs).
    for (const locals of ctx.after.pouLocals.values()) {
      for (const l of locals) {
        const f = flag({ ...l, kind: 'var_local' });
        if (!f) continue;
        const k = `${f.file}::${f.line}::${l.name.toLowerCase()}`;
        if (seen.has(k)) continue;
        seen.add(k);
        findings.push(f);
      }
    }
    return findings;
  },
};
