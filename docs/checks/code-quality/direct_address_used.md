# DIRECT_ADDRESS_USED

**Severity:** `info` by default; `warn` under the PLCopen preset.
**PLCopen:** N1 / CP1 — access I/O and memory by symbolic name, not by physical address.

A direct (physical) address — `%I0.0`, `%Q1.2`, `%MW100`, `%QX0.7`, etc. — is referenced in code instead of a named symbol mapped to that address. Direct addresses break portability between target controllers, hide intent from readers, and make remapping I/O at integration time invasive.

**Settings.** No check-specific config.

**Trigger.**

```pascal
bResult := %I0.0;                 (* fires *)
%Q0.1 := bResult;                 (* fires *)
```

**The bot posts.**

```
🟦 info  DIRECT_ADDRESS_USED
Direct address %I0.0 used (PLCopen N1 / CP1)
```

**Fix.** Declare a named global mapped to the address (`xStartButton AT %IX0.0 : BOOL;`) and reference the name.
