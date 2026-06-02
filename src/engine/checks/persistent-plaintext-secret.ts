import type { Check, Finding, GlobalVar } from '../types.js';

// IEC 62443-4-2 CR 4.1 (information confidentiality): the component shall
// protect the confidentiality of information at rest. A secret-named global
// declared `VAR_GLOBAL PERSISTENT` or `RETAIN` is stored in non-volatile
// memory of the PLC across power cycles — anyone with physical access or
// engineering-tool access reads it in cleartext. Even without an initial
// literal value (which `HARDCODED_CREDENTIALS` already catches), the *shape*
// of "persistent storage of a secret-named variable" is itself the finding.

// Same secret-name patterns the credentials check uses — kept in sync so the
// two checks treat the same names as sensitive.
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

function isSecretName(name: string): boolean {
  for (const pat of SECRET_NAME_PATTERNS) if (pat.test(name)) return true;
  return false;
}

function flag(g: GlobalVar): Finding | null {
  if (!g.retain) return null;
  if (!isSecretName(g.name)) return null;
  return {
    severity: 'error',
    category: 'PERSISTENT_PLAINTEXT_SECRET',
    file: g.file,
    line: g.line,
    summary: `Secret-named global '${g.name}' is declared PERSISTENT/RETAIN — stored in plaintext NV memory (IEC 62443-4-2 CR 4.1)`,
    detail:
      "IEC 62443-4-2 CR 4.1 (information confidentiality at rest): PLC PERSISTENT / RETAIN variables survive power cycles in non-volatile memory and are readable by anyone with engineering-tool access or physical access to the runtime. Storing a secret-named value (password / token / API key / private key) there exposes the credential to backup dumps, retain-image extractions, and online-monitoring. Move the secret out of PERSISTENT storage: load it at startup from a key-management facility, accept it as a runtime input, or store only an irreversible hash if equality comparison is all you need.",
  };
}

export const persistentPlaintextSecret: Check = {
  category: 'PERSISTENT_PLAINTEXT_SECRET',
  defaultSeverity: 'error',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const g of ctx.before.globalDecls) {
      const f = flag(g);
      if (f) beforeBad.add(`${f.file}::${f.line}::${g.name.toLowerCase()}`);
    }
    const seen = new Set<string>();
    for (const g of ctx.after.globalDecls) {
      const f = flag(g);
      if (!f) continue;
      const k = `${f.file}::${f.line}::${g.name.toLowerCase()}`;
      if (beforeBad.has(k)) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      findings.push(f);
    }
    return findings;
  },
};
