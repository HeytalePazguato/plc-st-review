# UNUSED_VAR_INTRODUCED

**Severity:** `info`

A new local variable was declared in this PR but isn't referenced
anywhere in its scope.

**Why it matters.** A leftover from a refactor that never finished,
or a placeholder that someone forgot to wire up. Cheap to flag,
cheap to fix.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* new in this PR: *)
VAR
    iUnused : INT;
END_VAR
```

**The bot posts.**

```
🟦 info  UNUSED_VAR_INTRODUCED
Variable iUnused introduced in FB_X but not referenced
Either remove the declaration or add a use of it.
```

**Fix.** Remove the declaration or add the missing reference.
