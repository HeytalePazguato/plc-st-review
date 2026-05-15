# BISTABLE_DOMINANCE_MISMATCH

**Severity:** `info` (heuristic)

Variable naming hints at the wrong bistable dominance. `SR` is
set-dominant; `RS` is reset-dominant. Names containing `eStop`,
`reset`, `trip`, `fault`, `safety`, `lock` suggest reset-dominant
(`RS`); names containing `set`, `latch`, `enable`, `start`, `arm`
suggest set-dominant (`SR`).

**Why it matters.** Pure heuristic, names lie, conventions vary.
But on the codebases where naming is disciplined, mismatched
dominance is usually a real bug, and the false-positive rate is
manageable.

**Settings.** Disable per-repo if your shop's naming doesn't match
the heuristic's word lists:

```yaml
disabled_checks:
  - BISTABLE_DOMINANCE_MISMATCH
```

**Trigger.**

```pascal
eStopLatch : SR;                   (* fires, name suggests reset-dominant *)
```

**The bot posts.**

```
🟦 info  BISTABLE_DOMINANCE_MISMATCH
eStopLatch is SR but its name suggests RS
(set-dominant vs reset-dominant)
```

**Fix.** Either change the type to match the intent (`SR` → `RS` or
vice versa), or rename the variable.

