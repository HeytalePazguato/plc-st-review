# ASSIGNMENT_IN_CONDITION

**Severity:** `warn`

`:=` used inside an `IF` / `WHILE` / `REPEAT` condition expression.

**Why it matters.** IEC 61131-3 evaluates `x := y` as the assigned
value, so `IF x := y THEN` works, but the human intent is almost
always `IF x = y THEN`. Easy to typo, hard to spot.

**Settings.** No check-specific config.

**Trigger.**

```pascal
IF iCounter := 0 THEN ...          (* fires, probably meant `IF iCounter = 0` *)
```

**The bot posts.**

```
🟧 warn  ASSIGNMENT_IN_CONDITION
Assignment (`:=`) used inside a conditional expression
IEC 61131-3 `IF x := y THEN` performs an assignment then tests the
result. Almost always a typo for `IF x = y THEN`.
```

**Fix.** Change `:=` to `=`, or pull the assignment out above the
conditional if it was deliberate.
