# DEBUG_PRAGMA_IN_PRODUCTION

**Severity:** `warn`

A vendor pragma whose name matches a debug / test / monitoring pattern is present in a non-test source path.

**Why it matters.** IEC 62443-4-1 SI-2 (secure coding) and SVV (secure verification & validation activities): debug-only or test-only instrumentation should not ship to production. The most common cases in IEC 61131-3 are vendor-specific attribute pragmas:

- CODESYS `{attribute 'monitoring' := 'variable'}` — exposes the variable to live engineering-tool monitoring.
- CODESYS / TwinCAT `{attribute 'force_init' := …}` — pre-populates runtime values for testing; survives into production if left in.
- CODESYS `{attribute 'instance-path'}` — reveals the runtime path string of an instance, useful for telemetry but a leak for an attacker enumerating internal structure.
- Any pragma whose text contains the words `debug`, `test`, or `trace`.

Left in production these increase the attack surface, leak diagnostic state through the engineering interface, or anchor test-fixture values in non-volatile storage.

**Settings.** No check-specific config in v0.x. Patterns matched (case-insensitive, substring):

- `\bdebug\b`
- `\btest\b`
- `\bmonitoring\b`
- `\bforce[_-]?init\b`
- `\btrace\b`
- `\binstance[_-]?path\b`

**Test-path skip.** Files under `tests/`, `test/`, `examples/`, `example/`, `fixtures/`, `fixture/`, or with a `_test.st` suffix are exempt — the pragma is presumed legitimate there.

**Trigger.**

```pascal
(* in src/FB_M.st — production path *)
{attribute 'monitoring' := 'variable'}
FUNCTION_BLOCK FB_M
VAR iCount : INT; END_VAR
END_FUNCTION_BLOCK                       (* fires *)

(* in tests/FB_M_test.st — skipped *)
{attribute 'monitoring' := 'variable'}
FUNCTION_BLOCK FB_M_test                 (* OK — test path *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟧 warn  DEBUG_PRAGMA_IN_PRODUCTION
Debug / test pragma in production source: `{attribute 'monitoring' := 'variable'}` (IEC 62443-4-1 SI-2)
```

**Fix.** Remove the pragma, gate it behind a build configuration that is off in production, or move the file under a test path that the check skips.
