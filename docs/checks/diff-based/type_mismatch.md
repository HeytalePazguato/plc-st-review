# TYPE_MISMATCH

**Severity:** `error`

A `VAR_GLOBAL` declaration's type changed between revisions.

**Why it matters.** Global type changes often pass compile (especially between numerically-similar types like `INT` and `WORD`) but produce silent precision loss or sign-bit surprises at runtime. Listing every file that references the global makes the cleanup scope obvious in review.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                       (* after *)
VAR_GLOBAL                         VAR_GLOBAL
    gFlow : REAL := 0.0;               gFlow : INT := 0;
END_VAR                            END_VAR
```

**The bot posts.**

```
🟥 error  TYPE_MISMATCH
Global 'gFlow' type changed: REAL → INT
Callers in 3 files may need updating.
```

**Fix.** Revert the type, or update every reader / writer to match.
