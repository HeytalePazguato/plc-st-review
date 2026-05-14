# ENUM_VALUE_REMOVED

**Severity:** `error`

A `CASE` statement in some other file still references an enum value
that was removed from the enum.

**Why it matters.** Removing an enum value is a refactor; failing to
update every CASE on that enum is a compile failure that the engine
catches across files even when the offending CASE wasn't touched in
this PR.

**Settings.** No check-specific config.

**Trigger.**

```pascal
(* before: TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE *)
(* after:  TYPE E_State : (IDLE, RUNNING);        END_TYPE *)

(* Conveyor_HMI.st, unchanged in this PR: *)
CASE eState OF
    E_State.IDLE: ...
    E_State.FAULT: ...   (* fires — value no longer exists *)
END_CASE;
```

**The bot posts.**

```
🟥 error  ENUM_VALUE_REMOVED
CASE references removed enum value E_State.FAULT
E_State.FAULT was removed from the enum at E_State.st:5
```

**Fix.** Restore the enum value, or update the CASE to drop the
reference.
