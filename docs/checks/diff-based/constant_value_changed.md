# CONSTANT_VALUE_CHANGED

**Severity:** `info` (`warn` when name matches a safety-critical prefix)

A `VAR_GLOBAL CONSTANT`'s initial value changed.

**Why it matters.** Constants encode design assumptions (max speed, trip thresholds, retry counts). Changing one without a note in the PR often surfaces months later as a regression. The safety-prefix bump catches the high-risk cases automatically.

**Settings.** `safety_critical_prefixes` (default: `SAFETY_, INTERLOCK_, SIL_, LIMIT_, MAX_, MIN_`) controls which identifiers elevate to `warn`.

```yaml
safety_critical_prefixes:
  - SAFETY_
  - SIL_
  - EMERGENCY_
```

**Trigger.**

```pascal
(* before *)                              (* after *)
VAR_GLOBAL CONSTANT                       VAR_GLOBAL CONSTANT
    SAFETY_TIMEOUT : TIME := T#2s;            SAFETY_TIMEOUT : TIME := T#10s;
END_VAR                                   END_VAR
```

**The bot posts.**

```
🟧 warn  CONSTANT_VALUE_CHANGED
Constant SAFETY_TIMEOUT: T#2s → T#10s
Identifier prefix matches a safety-critical pattern;
double-check the change is approved.
```

**Fix.** If documented and reviewed, suppress with `disabled_checks` or tune `safety_critical_prefixes`. Otherwise revert.
