# UNREACHABLE_CODE

**Severity:** `warn`

A statement was newly placed after `RETURN` / `EXIT` / `CONTINUE` in the same block.

**Why it matters.** Either the terminator is in the wrong place or the trailing statement is wrong. Both are bugs; both compile clean.

**Settings.** No check-specific config.

**Trigger.**

```pascal
RETURN;
iCount := 99;                      (* fires, unreachable *)
```

**The bot posts.**

```
🟧 warn  UNREACHABLE_CODE
Unreachable statement after RETURN
In scope FB_Diagnostics. Either remove the statement or move the
terminator after it.
```

**Fix.** Remove the statement, or move the terminator after it.
