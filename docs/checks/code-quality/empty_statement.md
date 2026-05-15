# EMPTY_STATEMENT

**Severity:** `info`

A lone `;` with nothing in front.

**Why it matters.** Usually leftover from a copy-paste or a debugger
session. Costs nothing to remove and tightens the diff for the next
reviewer.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF xCondition THEN
    ;                              (* fires *)
END_IF;
```

**The bot posts.**

```
🟦 info  EMPTY_STATEMENT
Empty statement (lone `;`)
An empty statement does nothing. Either remove it or replace it
with an explicit comment if the position is intentional.
```

**Fix.** Remove the statement, or replace with
`(* intentionally empty *)` if a placeholder is needed.
