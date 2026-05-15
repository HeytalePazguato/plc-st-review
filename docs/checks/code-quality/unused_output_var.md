# UNUSED_OUTPUT_VAR

**Severity:** `info`

A `VAR_OUTPUT` is declared but never written inside the POU.

**Why it matters.** Callers reading the output only ever see its
initial value. Often a half-finished refactor or a TODO that never
landed.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Pump
VAR_OUTPUT
    xDone : BOOL;                  (* fires if nothing in the body assigns xDone *)
END_VAR
```

**The bot posts.**

```
🟦 info  UNUSED_OUTPUT_VAR
VAR_OUTPUT xDone in FB_Pump is declared but never written
Callers reading this output will only ever see its initial value.
```

**Fix.** Wire the output to actual logic, or remove the declaration.
