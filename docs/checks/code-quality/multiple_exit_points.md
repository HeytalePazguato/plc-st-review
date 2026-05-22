# MULTIPLE_EXIT_POINTS

**Severity:** `info`

A POU has more than one `RETURN`.

**Why it matters.** Multiple exits make control flow harder to trace and tend to accumulate dead code or duplicate cleanup. Not universally bad, but worth flagging once you have 3+.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION Choose : INT
    IF xFastPath THEN
        Choose := 1;
        RETURN;                    (* exit 1 *)
    END_IF;
    Choose := 2;
    RETURN;                        (* exit 2, fires *)
END_FUNCTION
```

**The bot posts.**

```
🟦 info  MULTIPLE_EXIT_POINTS
Choose has 2 RETURN statements
Multi-exit POUs are harder to reason about and to trace. Where
practical, refactor so the POU has a single exit point.
```

**Fix.** Restructure with a single return point at the end of the POU, using `IF` / `CASE` to set the return variable.
