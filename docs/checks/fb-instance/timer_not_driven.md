# TIMER_NOT_DRIVEN

**Severity:** `warn`

A timer instance's `.Q` or `.ET` output is read elsewhere in the POU, but no call site for that instance drives `IN` — neither via a named argument (`IN := …`) **nor positionally** (the first positional arg of the standard `TON`/`TOF`/`TP` is `IN` per the IEC standard library).

**Why it matters.** A common pattern bug, the timer is called once without `IN`, then `Q` is sampled. `Q` stays at its initial value forever; the surrounding logic silently misfires.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(PT := T#5s);                    (* IN missing *)
IF T1.Q THEN ...                   (* will always read FALSE *)
```

**Not a trigger.** A standard positional call drives `IN` and is recognised as such:

```pascal
T1(bStart, T#5s);                  (* IN driven via the first positional arg *)
IF T1.Q THEN ...                   (* quiet — this is fine *)
```

**The bot posts.**

```
🟧 warn  TIMER_NOT_DRIVEN
Timer T1 (TON) has its Q/ET read but no call sets IN
The timer is invoked but never with a named `IN := ...` argument.
Q will stay at its initial value.
```

**Fix.** Add `IN := <condition>` to the timer call.
