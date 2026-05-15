# INPUT_VAR_WRITTEN

**Severity:** `warn`

A `VAR_INPUT` parameter is assigned inside the POU.

**Why it matters.** Writing to an input breaks the input/output
contract, the caller's value is gone on the next scan because the
caller will rewrite it. Almost always a sign of confused intent.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_INPUT
    rTarget : REAL;
END_VAR

rTarget := 100.0;                  (* fires *)
```

**The bot posts.**

```
🟧 warn  INPUT_VAR_WRITTEN
VAR_INPUT rTarget is being assigned inside FB_Pump
Writing to an input variable hides changes from the caller and
breaks the input-output contract. Use a local variable instead.
```

**Fix.** Copy into a local variable and modify the local.
