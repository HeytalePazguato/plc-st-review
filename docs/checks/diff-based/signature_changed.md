# SIGNATURE_CHANGED

**Severity:** `warn` (`error` on breaking changes)

A POU's inputs, outputs, or in-outs were renamed, removed, or had
their type changed.

**Why it matters.** A signature change ripples to every caller. The
breaking variant (removed / type-changed params, or a new required
input without a default) silently turns previously-passing calls into
type errors at compile time — or worse, into runtime misbehavior on
runtimes that auto-pad missing args. Catching the change at PR review
is much cheaper than chasing it down at install.

**Settings.** Severity is auto-elevated to `error` when the engine
detects a breaking change; `severity_overrides` replaces the entire
scaled severity if set.

**Trigger.**

```pascal
(* before *)                       (* after *)
FUNCTION_BLOCK FB_Pump             FUNCTION_BLOCK FB_Pump
VAR_INPUT                          VAR_INPUT
    xEnable : BOOL;                    xEnable : BOOL;
END_VAR                                xManualOverride : BOOL;  (* no default *)
                                   END_VAR
```

**The bot posts.**

```
🟥 error  SIGNATURE_CHANGED
function_block FB_Pump signature changed (breaking): +1 input
  + VAR_INPUT xManualOverride : BOOL
```

**Fix.** Either give the new input a default (`xManualOverride : BOOL := FALSE;`)
so callers don't have to update, or update every call site explicitly.
