# FORBIDDEN_STATEMENT

**Severity:** `warn`.
**PLCopen:** L10 — forbid `EXIT`, `CONTINUE`, and `GOTO`.

`EXIT`, `CONTINUE`, and `GOTO` jump out of structured-control flow. PLCopen's argument: they make loops and conditional blocks hard to reason about and are almost always a sign that the surrounding structure should be reshaped (e.g. into a `WHILE` with a clear exit condition).

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
🟧 warn  FORBIDDEN_STATEMENT
EXIT statement used (PLCopen L10)
```

**Fix.** Restructure the loop so the natural fall-through gets you where you want. `EXIT` can usually be replaced by a stronger loop condition; `CONTINUE` by an inverted `IF` that skips the rest of the body.
