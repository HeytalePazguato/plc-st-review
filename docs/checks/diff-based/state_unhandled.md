# STATE_UNHANDLED

**Severity:** `info`

A `CASE` on an enum has no `ELSE` and doesn't cover every enum value,
regardless of whether the enum changed in this PR.

**Why it matters.** Catches incomplete CASE statements that
`ENUM_VALUE_ADDED` doesn't — gaps that existed from day one or that
were missed during a previous refactor.

**Settings.** No check-specific config.

**Trigger.**

```pascal
TYPE E_State : (IDLE, RUNNING, FAULT); END_TYPE

CASE eState OF
    E_State.IDLE: ...
    E_State.RUNNING: ...
END_CASE;                          (* fires — FAULT not handled, no ELSE *)
```

**The bot posts.**

```
🟦 info  STATE_UNHANDLED
CASE on E_State is missing branches for 1 value(s) and has no ELSE
Unhandled: E_State.FAULT
```

**Fix.** Add the missing branches, or add an `ELSE` that handles
unknown states explicitly.
