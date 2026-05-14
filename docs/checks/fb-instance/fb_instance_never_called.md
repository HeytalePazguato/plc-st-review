# FB_INSTANCE_NEVER_CALLED

**Severity:** `warn`

An FB instance is declared, its outputs are read somewhere in the
POU, but no call site invokes it.

**Why it matters.** Outputs only update when the instance is called.
Reading `T1.Q` without ever calling `T1(...)` returns stale data
(usually the initial value forever).

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR
    T1 : TON;
END_VAR
(* no T1(...) call anywhere *)
IF T1.Q THEN ...                   (* fires — T1.Q read but T1 never invoked *)
```

**The bot posts.**

```
🟧 warn  FB_INSTANCE_NEVER_CALLED
FB instance T1 (TON) is read but never invoked
Outputs of an FB only update when the instance is called.
```

**Fix.** Add a call site for the instance, or remove the declaration
if it isn't needed.
