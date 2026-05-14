# ADDRESS_OF_CONSTANT

**Severity:** `warn`

`ADR(c)` where `c` is a `VAR_GLOBAL CONSTANT`.

**Why it matters.** A CONSTANT may live in flash / read-only storage
on some runtimes; dereferencing a pointer derived from it can fault.
Even when it works today, the pointer's value isn't actually mutable.

**Settings.** No check-specific config.

**Trigger.**

```pascal
VAR_GLOBAL CONSTANT
    cMax : INT := 100;
END_VAR

pMax := ADR(cMax);                 (* fires *)
```

**The bot posts.**

```
🟧 warn  ADDRESS_OF_CONSTANT
ADR(cMax) — taking the address of a CONSTANT
A CONSTANT may live in flash/read-only storage on some runtimes;
dereferencing a pointer derived from it can fault.
```

**Fix.** If you need a mutable copy, declare a regular `VAR_GLOBAL`
initialised to the constant value.
