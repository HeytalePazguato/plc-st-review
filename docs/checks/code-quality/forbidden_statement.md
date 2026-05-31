# FORBIDDEN_STATEMENT

**Severity:** `info` by default; `warn` under the PLCopen preset.

`EXIT`, `CONTINUE`, and `GOTO` jump out of structured-control flow. The argument against them (also captured in PLCopen rule **L10**): they make loops and conditional blocks hard to reason about and are almost always a sign that the surrounding structure should be reshaped (e.g. into a `WHILE` with a clear exit condition). This is contested — many shops happily use `EXIT` for early loop termination — so the default severity is `info`. Bump in your config if your team agrees with the strict view, or mute if not.

**Settings.** No check-specific config.

**Trigger.**

```pascal
WHILE i < 10 DO
    IF i = 5 THEN EXIT; END_IF;       (* fires *)
    IF i = 3 THEN CONTINUE; END_IF;   (* fires *)
    i := i + 1;
END_WHILE;
```

**The bot posts.**

```
🟦 info  FORBIDDEN_STATEMENT
EXIT statement used (PLCopen L10)
```

**Fix.** Restructure the loop so the natural fall-through gets you where you want. `EXIT` can usually be replaced by a stronger loop condition; `CONTINUE` by an inverted `IF` that skips the rest of the body.
