# IDENTIFIER_TOO_LONG

**Severity:** `info`.
**PLCopen:** N6 — set and enforce a team-agreed maximum identifier length.

A declared identifier is longer than the configured cap. No-op when no cap is set.

**Settings.** `limits.max_identifier_length` in `.plc-st-review.yml`. `0` or absent disables the check. The PLCopen preset sets it to **32**.

```yaml
limits:
  max_identifier_length: 32
```

**Trigger.** (With the cap set to 24.)

```pascal
VAR
    aVeryLongIdentifierNameThatGoesOnAndOnAndOn : INT;   (* fires *)
END_VAR
```

**The bot posts.**

```
🟦 info  IDENTIFIER_TOO_LONG
Identifier 'aVeryLong…' is 43 characters (cap 24) — PLCopen N6
```

**Fix.** Shorten the name (drop redundant words, use the team's standard abbreviations), or raise the cap if your team prefers longer descriptive names.
