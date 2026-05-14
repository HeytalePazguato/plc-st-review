# VARIABLE_SHADOWING

**Severity:** `warn`

A local variable has the same name as a `VAR_GLOBAL`. The local
hides the global inside this POU.

**Why it matters.** "Why isn't the global updating?" turns into a
30-minute debugging session. The local wins inside the POU; readers
two months later can't tell which one is meant.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_GLOBAL
    gFlow : REAL;
END_VAR

FUNCTION_BLOCK FB_Pump
VAR
    gFlow : REAL;                  (* fires — shadows global *)
END_VAR
```

**The bot posts.**

```
🟧 warn  VARIABLE_SHADOWING
gFlow (var_local) shadows a global of the same name
```

**Fix.** Rename the local, or remove it if the intent was to use the
global.
