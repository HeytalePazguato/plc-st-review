# UNQUALIFIED_ENUM_CONSTANT

**Severity:** `info`

A bare identifier reference matches a member of exactly one enum
type. Qualified form (`E_State.IDLE`) is clearer than the bare form
(`IDLE`).

**Why it matters.** Bare enum refs work because IEC ST hoists enum
members into scope, but they hide the type from anyone reading the
code and break grep / IDE refactoring.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING); END_TYPE

eState := IDLE;                    (* fires, should be E_State.IDLE *)
```

**The bot posts.**

```
🟦 info  UNQUALIFIED_ENUM_CONSTANT
'IDLE' looks like an enum member; consider writing it qualified
as E_State.IDLE
```

**Fix.** Qualify with the enum type name.
