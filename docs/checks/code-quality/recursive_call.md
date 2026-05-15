# RECURSIVE_CALL

**Severity:** `warn`

A POU invokes itself directly.

**Why it matters.** IEC 61131-3 implementations have a bounded
stack; recursion risks overflow on any input that nests beyond a
shallow depth. Convert to iteration where the algorithm allows.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Recur
VAR fbThis : FB_Recur; END_VAR
fbThis();                          (* fires *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟧 warn  RECURSIVE_CALL
Recursive call: FB_Recur calls itself
IEC 61131-3 implementations have a bounded stack; recursion risks
overflow on any input that nests deeper than a few levels.
```

**Fix.** Convert to iteration with an explicit stack / queue, or
prove the recursion depth is bounded and document the bound.
