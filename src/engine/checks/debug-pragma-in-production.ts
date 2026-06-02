import type { Check, Finding } from '../types.js';

// IEC 62443-4-1 SI-2 (secure coding) and SVV (secure-verification activities):
// debug-only or test-only instrumentation should not ship to production. In
// IEC 61131-3 the most common cases are vendor-specific attribute pragmas
// such as CODESYS `{attribute 'monitoring' := 'variable'}`,
// `{attribute 'debug'}`, or `{attribute 'force_init' := …}`, which expose
// internal state to the engineering tool or pre-populate runtime values for
// testing. Left in production these can:
//   - leak diagnostic data through the engineering interface;
//   - keep test-fixture values resident in non-volatile storage;
//   - increase the attack surface by enabling runtime introspection paths
//     that are otherwise dormant.

// Patterns matched (case-insensitive, substring on the pragma text). Vendor-
// specific names included; the spelling is what the developer would write.
const DEBUG_PRAGMA_PATTERNS: readonly RegExp[] = [
  /\bdebug\b/i,
  /\btest\b/i,
  /\bmonitoring\b/i,         // CODESYS
  /\bforce[_-]?init\b/i,     // CODESYS / TwinCAT
  /\btrace\b/i,
  /\binstance[_-]?path\b/i,  // CODESYS — exposes runtime path strings
];

// Test/example paths where these pragmas are legitimate. A file under any of
// these segments is skipped — match `tests/`, `test/`, `/_test.st` suffix,
// and the common `examples/` / `fixtures/` folders.
const TEST_PATH_RE = /(^|[\/\\])(tests?|examples?|fixtures?)([\/\\]|$)|_test\.st$/i;

function isTestFile(path: string): boolean {
  return TEST_PATH_RE.test(path);
}

function matchedPattern(text: string): RegExp | null {
  for (const pat of DEBUG_PRAGMA_PATTERNS) if (pat.test(text)) return pat;
  return null;
}

export const debugPragmaInProduction: Check = {
  category: 'DEBUG_PRAGMA_IN_PRODUCTION',
  defaultSeverity: 'warn',
  run(ctx) {
    const findings: Finding[] = [];
    const beforeBad = new Set<string>();
    for (const p of ctx.before.pragmas) {
      if (isTestFile(p.file)) continue;
      if (matchedPattern(p.text)) beforeBad.add(`${p.file}::${p.line}`);
    }
    const seen = new Set<string>();
    for (const p of ctx.after.pragmas) {
      if (isTestFile(p.file)) continue;
      const match = matchedPattern(p.text);
      if (!match) continue;
      const k = `${p.file}::${p.line}`;
      if (beforeBad.has(k)) continue; // pre-existing, not introduced in PR
      if (seen.has(k)) continue;
      seen.add(k);
      // Normalise the pragma text to one line for the summary; some pragmas
      // span newlines and would otherwise produce ugly review comments.
      const oneLine = p.text.replace(/\s+/g, ' ').trim();
      findings.push({
        severity: 'warn',
        category: 'DEBUG_PRAGMA_IN_PRODUCTION',
        file: p.file,
        line: p.line,
        summary: `Debug / test pragma in production source: \`${oneLine}\` (IEC 62443-4-1 SI-2)`,
        detail:
          "IEC 62443-4-1 SI-2 (secure coding) and SVV: debug-only or test-only pragmas should not ship in production code. Vendor-specific instrumentation pragmas like `'monitoring'`, `'debug'`, `'force_init'`, `'trace'`, and `'instance-path'` expose internal state, pre-populate test-fixture values, or enable runtime introspection paths that increase the attack surface. Remove the pragma, gate it behind a build configuration, or move the file under a `tests/` / `examples/` / `fixtures/` path (which this check skips by default).",
      });
    }
    return findings;
  },
};
