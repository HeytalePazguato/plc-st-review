# TIMER_PT_ZERO

**Severity:** `error`

A `TON` / `TOF` / `TP` is set with `PT := T#0s`, or a constant that resolves to zero.

**Why it matters.** `PT = 0` fires immediately on `TON` / `TP` (the delay is zero) or never on `TOF` (the off-delay is zero). Almost always the wrong intent.

**Settings.** No check-specific config.

**`PT` recognition.** `PT` is read from both standard call-arg style (`T1(PT := T#0s)`) and the B&R-style member assignment (`T1.PT := T#0s;` then `T1();`). The parameter name is matched case-insensitively in the default dialect, so `pt :=` works the same as `PT :=`.

**Trigger.**

```pascal
T1(IN := xEnable, PT := T#0s);     (* fires *)
T1.PT := T#0s; T1();               (* fires (member-assignment idiom) *)
T1(IN := xEnable, pt := T#0s);     (* fires (case-insensitive default) *)
```

**The bot posts.**

```
🟥 error  TIMER_PT_ZERO
Timer T1.PT resolves to T#0s (value: T#0s)
A PT of zero either fires immediately (TON/TP) or never (TOF on
falling edge), neither of which is usually intended.
```

**Fix.** Set a non-zero `PT`.
