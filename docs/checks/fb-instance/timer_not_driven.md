# TIMER_NOT_DRIVEN

**Severity:** `warn`

A timer instance's `.Q` or `.ET` output is read elsewhere in the POU, but no call site for that instance has an `IN` named argument.

**Why it matters.** A common pattern bug, the timer is called once without `IN`, then `Q` is sampled. `Q` stays at its initial value forever; the surrounding logic silently misfires.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(PT := T#5s);                    (* IN missing *)
IF T1.Q THEN ...                   (* will always read FALSE *)
```

**The bot posts.**

```
🟧 warn  TIMER_NOT_DRIVEN
Timer T1 (TON) has its Q/ET read but no call sets IN
The timer is invoked but never with a named `IN := ...` argument.
Q will stay at its initial value.
```

**Fix.** Add `IN := <condition>` to the timer call.
