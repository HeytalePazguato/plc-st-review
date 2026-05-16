# FB_INSTANCE_DOUBLE_CALL

**Severity:** `warn`

The same FB instance is invoked more than once within one POU's scan.

**Why it matters.** FB instances hold state between calls. Two calls in one scan means the second overwrites outputs the first produced, plus any internal counters / timers tick twice per scan.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(IN := xA, PT := T#1s);
T1(IN := xB, PT := T#1s);          (* fires *)
```

**The bot posts.**

```
🟧 warn  FB_INSTANCE_DOUBLE_CALL
FB instance T1 called 2 times in FB_Diagnostics
An FB instance holds state between calls. Multiple calls in one
scan overwrite outputs from earlier calls. Lines: 68, 71.
```

**Fix.** Use one instance per call site, or consolidate the calls behind a single condition.
