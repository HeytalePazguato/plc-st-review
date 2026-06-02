# POU_NOT_COMMENTED

**Severity:** `info`.
**PLCopen:** C2 — all code elements shall be commented.

A POU declaration has no comment immediately above (or on the same line as) it. PLCopen wants every code element to carry a header explaining its purpose, inputs/outputs, and any preconditions.

**Settings.** No check-specific config. A comment on any of the **6 lines immediately above** the POU declaration (or on the declaration line itself) satisfies the rule. Interface declarations are exempt — the methods inside them are what carry the documentation.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_Bare                 (* fires *)
VAR ... END_VAR
END_FUNCTION_BLOCK
```

**Not a trigger.**

```pascal
(* FB_Documented: rises the conveyor speed by rDelta each scan. *)
FUNCTION_BLOCK FB_Documented            (* quiet *)
```

**The bot posts.**

```
🟦 info  POU_NOT_COMMENTED
function_block FB_Bare has no leading comment (PLCopen C2)
```

**Fix.** Add a one- or two-line header comment above the POU keyword.
