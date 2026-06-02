# ENUM_VALUE_REMOVED

**Severity:** `error`

A `CASE` statement in some other file still references an enum value that was removed from the enum.

**Why it matters.** Removing an enum value is a refactor; failing to update every CASE on that enum is a compile failure that the engine catches across files even when the offending CASE wasn't touched in this PR.

**Settings.** No check-specific config; honours the dialect-wide [`case_sensitive`](../../case-sensitivity.md) setting. Under the default case-insensitive dialect, renaming a value case-only (`idle` → `IDLE`) is **not** reported as a removal — it's still the same value. Under `case_sensitive: true` (B&R) the same change **is** reported, since `idle` and `IDLE` are genuinely different values there.

**Match accuracy.** CASE arms are matched **exactly** against either the bare value name (`FAULT:`) or the qualified form (`E_State.FAULT:`), with comma-separated multi-value arms split. Removing `STOP` is not masked or wrongly attributed by a surviving `EMERGENCY_STOP` arm — those are different identifiers, not a substring match.

**Trigger.**

```pascal
(* before: TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE *)
(* after:  TYPE E_State : (IDLE, RUNNING);        END_TYPE *)

(* Conveyor_HMI.st, unchanged in this PR: *)
CASE eState OF
    E_State.IDLE: ...
    E_State.FAULT: ...   (* fires, value no longer exists *)
END_CASE;
```

**The bot posts.**

```
🟥 error  ENUM_VALUE_REMOVED
CASE references removed enum value E_State.FAULT
E_State.FAULT was removed from the enum at E_State.st:5
```

**Fix.** Restore the enum value, or update the CASE to drop the reference.
