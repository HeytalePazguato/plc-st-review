# OUTPUT_VAR_READ_INTERNALLY

**Severity:** `info`

A `VAR_OUTPUT` is read inside the same POU.

**Why it matters.** Outputs are for publishing state to callers, not
internal working storage. Reading one back inside the POU usually
means you wanted a local intermediate variable.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_OUTPUT
    rResult : REAL;
END_VAR

rResult := rResult + rInput;       (* fires, rResult on the RHS *)
```

**The bot posts.**

```
🟦 info  OUTPUT_VAR_READ_INTERNALLY
VAR_OUTPUT rResult is read inside FB_Pump
An output is meant to publish a result, not to store working state.
Reading it back inside the same POU usually means you wanted a
local intermediate.
```

**Fix.** Introduce a local for the working value and assign the
output once at the end of the POU.
