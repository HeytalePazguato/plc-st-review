# ENUM_VALUE_ADDED

**Severity:** `warn`

An enum gained a value and a `CASE` on that enum (in any file) has no
matching branch and no `ELSE`.

**Why it matters.** Adding a new state without updating every consumer
is the most common state-machine bug. The check is the inverse of
ENUM_VALUE_REMOVED, both directions need surveillance.

**Settings.** No check-specific config. See also `STATE_UNHANDLED`,
which fires on the same shape even when the enum hasn't changed.

**Trigger.**

```pascal
(* before: TYPE E_State : (IDLE, RUNNING); END_TYPE *)
(* after:  TYPE E_State : (IDLE, RUNNING, ERROR_RECOVERY); END_TYPE *)

CASE eState OF
    E_State.IDLE: ...
    E_State.RUNNING: ...
END_CASE;                        (* fires, no ERROR_RECOVERY branch, no ELSE *)
```

**The bot posts.**

```
🟧 warn  ENUM_VALUE_ADDED
CASE does not handle new enum value(s): E_State.ERROR_RECOVERY
Enum E_State gained 1 value(s); this CASE has no ELSE branch.
```

**Fix.** Add the missing branch, or add an `ELSE` that handles
unknown states.
