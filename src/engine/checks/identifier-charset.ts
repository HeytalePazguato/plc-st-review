import type { Check, Finding, NamedDecl } from '../types.js';

// PLCopen N8 — every declared identifier must match the project's acceptable
// character set, configured via `identifier_charset: '<regex>'` in
// `.plc-st-review.yml`. The check no-ops when no pattern is set.

function key(d: NamedDecl): string {
  return `${d.file}::${d.line}::${d.name}`;
}

export const identifierCharset: Check = {
  category: 'IDENTIFIER_CHARSET',
  defaultSeverity: 'info',
  run(ctx) {
    const pattern = ctx.config.identifierCharsetPattern;
    if (pattern === null) return [];
    let re: RegExp;
    try {
      re = new RegExp(pattern);
    } catch {
      // Malformed regex in config — silently skip the check so a typo doesn't
      // brick the whole run. The config loader could also reject it earlier.
      return [];
    }
    const findings: Finding[] = [];
    const before = new Set(
      ctx.before.declarations.filter((d) => !re.test(d.name)).map(key),
    );
    const reported = new Set<string>();
    for (const d of ctx.after.declarations) {
      if (re.test(d.name)) continue;
      const k = key(d);
      if (before.has(k)) continue;
      if (reported.has(k)) continue;
      reported.add(k);
      findings.push({
        severity: 'info',
        category: 'IDENTIFIER_CHARSET',
        file: d.file,
        line: d.line,
        summary: `Identifier '${d.name}' contains characters outside the configured set (PLCopen N8)`,
        detail: `PLCopen N8: project-wide identifier charset is \`${pattern}\`. Either rename '${d.name}' to fit the pattern, or relax the regex in \`.plc-st-review.yml\` if your team's convention is broader.`,
      });
    }
    return findings;
  },
};
