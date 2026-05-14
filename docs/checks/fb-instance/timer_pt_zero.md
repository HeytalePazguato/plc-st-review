# TIMER_PT_ZERO

**Severity:** `error`

A `TON` / `TOF` / `TP` is set with `PT := T#0s`, or a constant that
resolves to zero.

**Why it matters.** `PT = 0` fires immediately on `TON` / `TP` (the
delay is zero) or never on `TOF` (the off-delay is zero). Almost
always the wrong intent.

**Settings.** No check-specific config.

**Trigger.**

```pascal
T1(IN := xEnable, PT := T#0s);     (* fires *)
```

**The bot posts.**

```
🟥 error  TIMER_PT_ZERO
Timer T1.PT resolves to T#0s (value: T#0s)
A PT of zero either fires immediately (TON/TP) or never (TOF on
falling edge), neither of which is usually intended.
```

**Fix.** Set a non-zero `PT`.
