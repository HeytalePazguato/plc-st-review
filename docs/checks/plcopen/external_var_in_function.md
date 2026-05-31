# EXTERNAL_VAR_IN_FUNCTION

**Severity:** `warn`.
**PLCopen:** CP6 — avoid VAR_EXTERNAL inside FUNCTION / FUNCTION_BLOCK / METHOD.

A `VAR_EXTERNAL` declaration appears inside a FUNCTION, FUNCTION_BLOCK, or METHOD body. PLCopen forbids this because reaching directly into global state from a function-like POU makes it stateful, hard to test in isolation, and brittle when the global is renamed or retyped.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_GLOBAL gFlow : REAL; END_VAR

FUNCTION_BLOCK FB_X
VAR_EXTERNAL
    gFlow : REAL;            (* fires *)
END_VAR
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟧 warn  EXTERNAL_VAR_IN_FUNCTION
VAR_EXTERNAL gFlow declared inside function_block FB_X (PLCopen CP6)
```

**Fix.** Pass the global in via `VAR_INPUT` or `VAR_IN_OUT`. If the FB legitimately needs to share state, an instance of a "state holder" FB is usually clearer than a `VAR_EXTERNAL`.
