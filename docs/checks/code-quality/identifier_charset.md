# IDENTIFIER_CHARSET

**Severity:** `info`.
**PLCopen:** N8 — define and enforce a project-wide acceptable character set for identifiers.

A declared identifier contains characters outside the project's configured allowed set. No-op when no pattern is configured.

**Settings.** `identifier_charset` in `.plc-st-review.yml`. Set to a regex that every identifier must **fully** match. The PLCopen preset sets it to `'^[A-Za-z_][A-Za-z0-9_]*$'` — the IEC 61131-3 standard's identifier grammar (ASCII letters, digits, underscore, with a letter or underscore lead).

```yaml
identifier_charset: '^[A-Za-z_][A-Za-z0-9_]*$'
```

**Trigger.** (Pattern: `^[A-Z][A-Z0-9_]*$` — UPPER_SNAKE_CASE only.)

```pascal
VAR
    mixedCase : INT;          (* fires — pattern requires UPPER *)
END_VAR
```

**The bot posts.**

```
🟦 info  IDENTIFIER_CHARSET
Identifier 'mixedCase' contains characters outside the configured set (PLCopen N8)
```

**Fix.** Rename the identifier to match the pattern, or broaden the regex in `.plc-st-review.yml` if your team's convention is wider than the configured one.
