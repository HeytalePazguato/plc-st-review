# BOOL_COMPARISON

**Severity:** `info`

A BOOL variable is compared with `= TRUE` or `= FALSE`. The
comparison adds no information.

**Why it matters.** Style nit — `IF b THEN` is universally clearer
than `IF b = TRUE THEN`, and the latter sometimes hides intent in
nested logic.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF xEnable = TRUE THEN ...         (* fires *)
IF xEnable = FALSE THEN ...        (* fires *)
```

**The bot posts.**

```
🟦 info  BOOL_COMPARISON
Comparison against a boolean literal (e.g. `IF b = TRUE`)
A BOOL variable is already true/false. `IF b` and `IF NOT b` are
clearer than `IF b = TRUE` / `IF b = FALSE`.
```

**Fix.** Drop the comparison: `IF xEnable THEN` or `IF NOT xEnable
THEN`.
