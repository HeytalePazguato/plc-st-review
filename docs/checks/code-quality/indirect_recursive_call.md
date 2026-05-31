# INDIRECT_RECURSIVE_CALL

**Severity:** `error`.
**PLCopen:** CP13 (indirect) — POUs shall not call themselves directly or indirectly.

The call graph contains a cycle of two or more POUs (A → B → A, possibly through more hops). Indirect recursion has the same risk as direct recursion (which is reported by `RECURSIVE_CALL`): unbounded stack growth on a runtime that is typically single-stack and not designed for it.

**Settings.** No check-specific config. The cycle is computed against the symbol-table call graph; calls inferred from instance variables (e.g. `myFb()` where `myFb : FB_X`) count, as do direct POU calls.

**Trigger.**

```pascal
FUNCTION_BLOCK FB_A
VAR fb : FB_B; END_VAR
fb();
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_B
VAR fa : FB_A; END_VAR
fa();                                  (* fires — FB_A → FB_B → FB_A *)
END_FUNCTION_BLOCK
```

**The bot posts.**

```
🟥 error  INDIRECT_RECURSIVE_CALL
Indirect recursion: FB_A -> FB_B -> FB_A (PLCopen CP13)
```

**Fix.** Break the cycle by extracting the shared work into a third POU that both can call without forming a loop.
