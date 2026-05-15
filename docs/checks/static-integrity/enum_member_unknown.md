# ENUM_MEMBER_UNKNOWN

**Severity:** `error`

A qualified reference like `E_State.IDEL` doesn't match any declared
member of `E_State`. Likely a typo. The detail lists the actual
members as candidates.

**Why it matters.** Catches a common typo class (transposition,
missing letter, wrong casing on case-sensitive runtimes) before it
compiles fine due to misleading defaults.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE

eState := E_State.IDEL;            (* typo, fires *)
```

**The bot posts.**

```
🟥 error  ENUM_MEMBER_UNKNOWN
Unknown enum member E_State.IDEL
Enum E_State has values: IDLE, RUNNING, FAULT. Likely typo.
```

**Fix.** Correct the typo.
