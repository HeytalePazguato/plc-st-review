# UNUSED_INPUT_VAR

**Severity:** `info`

A `VAR_INPUT` parameter is declared but never read inside the POU
body.

**Why it matters.** Either the input was added speculatively and
forgotten, or the consuming logic was deleted and the input left
behind. Either way it pollutes the interface.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Pump
VAR_INPUT
    xEnable : BOOL;
    xUnused : BOOL;                (* fires — never used *)
END_VAR
```

**The bot posts.**

```
🟦 info  UNUSED_INPUT_VAR
VAR_INPUT xUnused in FB_Pump is never read in the POU body
Either remove the input or replace its usages with the actual
logic that should have consumed it.
```

**Fix.** Remove the input, or add the logic that should have used
it.
