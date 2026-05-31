# FOR_LOOP_VAR_MODIFIED

**Severity:** `warn`.
**PLCopen:** L12 — a `FOR` loop counter shall not be modified inside the loop body.

The loop counter is assigned to inside the loop body. Per IEC 61131-3 and PLCopen, doing this is undefined — implementations may honour the new value, ignore it, or loop unexpectedly long. Either way the loop's intent is gone.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FOR i := 1 TO 10 DO
    i := i + 2;                       (* fires — skips iterations *)
END_FOR;
```

**The bot posts.**

```
🟧 warn  FOR_LOOP_VAR_MODIFIED
FOR-loop counter 'i' assigned inside the loop body (PLCopen L12)
```

**Fix.** Use a `WHILE` loop if the iteration count is genuinely dynamic. If you just wanted a different step, use the `BY` clause of the `FOR` (`FOR i := 1 TO 10 BY 2 DO`).
