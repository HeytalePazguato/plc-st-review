# IF_WITHOUT_ELSE

**Severity:** `warn`.
**PLCopen:** L17 — every `IF` shall have an `ELSE` clause.

An `IF` (or `IF ... ELSIF ...`) statement is missing a final `ELSE`. PLCopen's reasoning: the "neither branch holds" path should be explicit so a future reader knows the no-op was intentional, not forgotten.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF x > 0 THEN
    x := x + 1;
END_IF;                          (* fires — no ELSE *)
```

**The bot posts.**

```
🟧 warn  IF_WITHOUT_ELSE
IF statement without an ELSE clause (PLCopen L17)
```

**Fix.** Add an `ELSE ;` (even an empty one with a comment explaining why) so the no-op branch is intentional and visible.
