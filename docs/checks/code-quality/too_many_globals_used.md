# TOO_MANY_GLOBALS_USED

**Severity:** `warn`.
**PLCopen:** CP18 — limit use of global variables.

A POU references more distinct globals than the configured cap. PLCopen treats heavy use of globals as a smell: a POU that pulls from many globals is hard to test in isolation, hard to reason about, and brittle when those globals are renamed or retyped.

**Settings.** `limits.max_globals_used_per_pou` in `.plc-st-review.yml`. `0` or absent disables the check. The PLCopen preset sets it to **10**.

```yaml
limits:
  max_globals_used_per_pou: 10
```

References are counted as **distinct global names** within the POU, not total reads — using `gA` twice still counts as one global.

**Trigger.** (With the cap set to 2.)

```pascal
VAR_GLOBAL gA, gB, gC, gD : INT; END_VAR

FUNCTION_BLOCK FB_X
VAR x : INT; END_VAR
x := gA + gB + gC + gD;                  (* fires — 4 > 2 *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟧 warn  TOO_MANY_GLOBALS_USED
function_block FB_X references 4 distinct globals (cap 2) — PLCopen CP18
```

**Fix.** Pass the values in through VAR_INPUT, or wrap related globals in a STRUCT global and pass the struct.
