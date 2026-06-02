# COUNTER_PV_ZERO

**Severity:** `error`

A `CTU` / `CTD` / `CTUD` is initialized with `PV := 0`.

**Why it matters.** A preset of 0 makes the counter trip immediately on `CTU` (Q is TRUE the first scan) or never on `CTD` (CV can't go below 0). Either way the counter isn't useful.

**Settings.** No check-specific config.

**Literal forms understood.** `PV` is decoded across any standard ST numeric literal — `16#0`, `2#0`, `INT#0`, `0`, etc. — so a zero preset written in hex or binary isn't missed.

**Trigger.**

```pascal
C1(CU := xPulse, PV := 0);         (* fires *)
C1(CU := xPulse, PV := 16#0);      (* fires *)
```

**The bot posts.**

```
🟥 error  COUNTER_PV_ZERO
Counter C1.PV resolves to zero (value: 0)
A preset of 0 makes the counter trip immediately on the first
count or never count at all, depending on type.
```

**Fix.** Set a positive preset, or remove the counter if it isn't needed.
