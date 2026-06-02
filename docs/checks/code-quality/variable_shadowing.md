# VARIABLE_SHADOWING

**Severity:** `warn`

A **local declaration** has the same name as a `VAR_GLOBAL`. The local hides the global inside this POU — every reference resolves to the local, the global is silently unread.

**Why it matters.** "Why isn't the global updating?" turns into a 30-minute debugging session. The local wins inside the POU; readers two months later can't tell which one is meant.

**What counts as "local".** Every declaration kind that lives in a POU's local namespace: value kinds (`VAR`, `VAR_INPUT`, `VAR_OUTPUT`, `VAR_IN_OUT`, `VAR_TEMP`) **and** instance kinds (FB instances, timer / counter / edge-trigger / bistable instances). So a local `myPump : FB_Pump;` correctly shadows a global of the same name and fires the check.

**Settings.** No check-specific config. Comparison honours the [`case_sensitive`](../../case-sensitivity.md) setting — case-insensitive (default) matches `level` against `Level`; case-sensitive (B&R) requires an exact match.

**Trigger.**

```pascal
VAR_GLOBAL
    gFlow  : REAL;
    myPump : FB_Pump;              (* a globally-shared instance *)
END_VAR

FUNCTION_BLOCK FB_Pump
VAR
    gFlow : REAL;                  (* fires — value shadows global *)
END_VAR
END_FUNCTION_BLOCK

PROGRAM Main
VAR
    myPump : FB_Pump;              (* fires — local instance shadows global instance *)
END_VAR
END_PROGRAM
```

**The bot posts.**

```
🟧 warn  VARIABLE_SHADOWING
gFlow (var_local) shadows a global of the same name
```

**Fix.** Rename the local, or remove it if the intent was to use the global.
