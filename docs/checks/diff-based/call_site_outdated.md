# CALL_SITE_OUTDATED

**Severity:** `error`

A caller doesn't pass a required argument that the callee now requires, or passes an argument name the callee doesn't have. Resolves FB-instance calls (e.g. `fbConveyor(...)`) through their type back to the POU.

**Why it matters.** This is the "missing the new arg" half of every `SIGNATURE_CHANGED` finding. Without it, a `warn` on the FB and an unrelated `green` on the consumer can ship a real bug.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* FB_Pump gained a required xManualOverride; the caller didn't update: *)
fbPump(xEnable := TRUE, rSetpoint := 50.0);
```

**The bot posts.**

```
🟥 error  CALL_SITE_OUTDATED
Call to FB_Pump is out of date with its signature
Missing required arguments: xManualOverride
```

**Fix.** Add the missing argument or correct the typo. If the new input shouldn't be the caller's responsibility, add a default to the callee instead.
