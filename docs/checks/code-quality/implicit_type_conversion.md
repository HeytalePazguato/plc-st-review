# IMPLICIT_TYPE_CONVERSION

**Severity:** `info`.
**PLCopen:** CP25 — data-type conversions shall be explicit.

A binary `+`, `-`, `*`, or `/` mixes operands from different numeric type families: an INT-family operand (`INT`, `DINT`, `LINT`, `BYTE`, `WORD`, `DWORD`, …) on one side and a REAL-family one (`REAL`, `LREAL`) on the other. The runtime inserts an implicit conversion; PLCopen wants the cast to be visible in the source.

**Settings.** No check-specific config. This check uses a deliberately conservative subset of type detection — declared variable types and literal shape (`3.14` vs `42` vs `16#FF`) — so subtler cases (typed temporaries, sub-expressions involving function returns) are not flagged. Full type inference would catch more but isn't on the roadmap.

**Trigger.**

```pascal
VAR
    i : INT;
    r : REAL;
END_VAR
r := i + 1.5;             (* fires — INT and REAL mixed in the + *)
```

**The bot posts.**

```
🟦 info  IMPLICIT_TYPE_CONVERSION
Implicit type conversion in 'i + 1.5' (mixing INT and REAL) — PLCopen CP25
```

**Fix.** Insert an explicit cast: `r := INT_TO_REAL(i) + 1.5;`. Or make both operands the same type up front.
