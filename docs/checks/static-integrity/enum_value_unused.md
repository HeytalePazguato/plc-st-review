# ENUM_VALUE_UNUSED

**Severity:** `info`

An enum value is declared but no longer referenced in any CASE or
member access in the repo.

**Why it matters.** Dead states accumulate. They're noise to the
reader and risk a typo (someone writes `E_State.OBSOLETE` thinking
it's still active). Surfacing them prompts a cleanup decision.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING, ARCHIVED); END_TYPE
(* no code anywhere references E_State.ARCHIVED *)
```

**The bot posts.**

```
🟦 info  ENUM_VALUE_UNUSED
Enum value E_State.ARCHIVED is no longer referenced anywhere
Either remove the value from the enum if it is genuinely obsolete,
or add a CASE branch that handles it.
```

**Fix.** Remove the value, or add the missing reference.
