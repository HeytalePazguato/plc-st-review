# POU_DELETED

**Severity:** `error` (with surviving callers) / `warn` (no callers)

A POU was deleted; the engine cross-checks the new revision for
surviving call sites.

**Why it matters.** The compiler tells you about callers; the engine
beats it to the answer at PR-review time. Severity downgrades when
there are no callers — that's a clean retirement.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* FB_Pump deleted from the codebase but MAIN.st still calls it: *)
fbPump(xEnable := TRUE);
```

**The bot posts.**

```
🟥 error  POU_DELETED
Call to deleted function_block FB_Pump
FB_Pump no longer exists in the new revision.
```

**Fix.** Restore the POU or update / delete the surviving call sites.
