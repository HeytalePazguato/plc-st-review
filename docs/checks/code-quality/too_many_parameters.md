# TOO_MANY_PARAMETERS

**Severity:** `warn`.
**PLCopen:** CP23 — define a maximum number of input / output / in-out variables.

A POU's interface size (inputs + outputs + in-outs combined) exceeds the configured cap. PLCopen treats long parameter lists as a smell — they're hard to call correctly, hard to document, and almost always indicate that some inputs should be grouped into a STRUCT.

**Settings.** `limits.max_parameters` in `.plc-st-review.yml`. `0` or absent disables the check. The PLCopen preset sets it to **8**.

```yaml
limits:
  max_parameters: 8
```

**Trigger.** (With the cap set to 3.)

```pascal
FUNCTION_BLOCK FB_Wide
VAR_INPUT
    a, b, c, d, e, f : INT;             (* fires — 6 > 3 *)
END_VAR
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟧 warn  TOO_MANY_PARAMETERS
function_block FB_Wide has 6 parameters (cap 3) — PLCopen CP23
```

**Fix.** Group related fields into a STRUCT and pass the STRUCT, or split the FB if its responsibilities are too broad.
