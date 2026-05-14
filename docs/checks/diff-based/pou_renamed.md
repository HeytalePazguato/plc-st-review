# POU_RENAMED

**Severity:** `info`

Heuristic: a deleted POU plus an added POU with an identical
signature in the same PR. Suggests a rename refactor.

**Why it matters.** Sometimes the engine sees "POU_DELETED" + "new
function block declared" — and these are the same thing. The
heuristic surfaces the likely intent so reviewers don't chase a
false alarm.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before *)                          (* after *)
FUNCTION_BLOCK FB_Old                 FUNCTION_BLOCK FB_New
VAR_INPUT                             VAR_INPUT
    xEnable : BOOL;                       xEnable : BOOL;
END_VAR                               END_VAR
END_FUNCTION_BLOCK                    END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟦 info  POU_RENAMED
Possible rename: FB_Old → FB_New
Both POUs share the same kind and signature.
```

**Fix.** If it was a rename, update every call site. If they're
actually different POUs that happen to share a signature, ignore.
