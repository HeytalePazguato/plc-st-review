# INFINITE_LOOP

**Severity:** `error`

`WHILE TRUE` (or `WHILE 1`) with no `EXIT` inside the body.

**Why it matters.** On a PLC scan, an infinite loop blocks the rest
of the program forever, eventually tripping the watchdog. Easy to
write by accident, catastrophic in production.

**Settings.** No check-specific config.

**Trigger.**

```pascal
WHILE TRUE DO
    iCounter := iCounter + 1;      (* fires, no EXIT *)
END_WHILE;
```

**The bot posts.**

```
🟥 error  INFINITE_LOOP
WHILE TRUE loop with no EXIT statement
On a PLC scan, an infinite loop blocks the rest of the program
forever. Either add EXIT inside the body or convert to a
state-driven structure.
```

**Fix.** Add an `EXIT` condition, or convert to a state machine that
runs one iteration per scan.
