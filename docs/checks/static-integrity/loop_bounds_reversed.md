# LOOP_BOUNDS_REVERSED

**Severity:** `error`

A `FOR` loop's bounds and step point opposite directions: positive step with `start > end`, or negative step with `start < end`.

**Why it matters.** Per IEC 61131-3 the body never runs (the condition is false on entry). On runtimes that wrap integer overflow, the loop runs hundreds of times before the counter comes back around to the end value, a runaway loop disguised as a no-op.

**Settings.** No check-specific config.

**Trigger.**

```pascal
FOR i := 10 TO 5 BY 1 DO ...       (* fires, positive step, start > end *)
FOR i := 1 TO 10 BY -1 DO ...      (* fires, negative step, start < end *)
```

**The bot posts.**

```
🟥 error  LOOP_BOUNDS_REVERSED
FOR loop bounds and step disagree: start (10) > end (5) with
positive step (1)
Per IEC 61131-3 the body never executes; on PLC runtimes that
wrap integer overflow the loop runs many more times than intended.
```

**Fix.** Swap `start` and `end`, or invert the `BY` direction.

