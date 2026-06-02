# LOOP_BOUNDS_REVERSED

**Severity:** `error`

A `FOR` loop's bounds and step point opposite directions: positive step with `start > end`, or negative step with `start < end`.

**Why it matters.** Per IEC 61131-3 the body never runs (the condition is false on entry). On runtimes that wrap integer overflow, the loop runs hundreds of times before the counter comes back around to the end value, a runaway loop disguised as a no-op.

**Settings.** No check-specific config.

**Step recognition.** The `BY` step is recognised in every common form: a signed literal (`BY -2`), a parenthesised expression (`BY (-2)`), a negated constant (`BY -STEP` where `STEP` is a `VAR_GLOBAL CONSTANT`), and the implicit `+1` when `BY` is omitted. A `BY` clause whose value can't be resolved to a constant (e.g. a runtime expression) is treated as **unknown** — the check skips rather than guessing `+1` and risking a false positive on a valid descending loop. Decimal, hex (`16#…`), binary (`2#…`), octal (`8#…`), and digit-separated (`1_000`) literals are all decoded to their real value.

**Trigger.**

```pascal
FOR i := 10 TO 5 BY 1 DO ...       (* fires, positive step, start > end *)
FOR i := 1 TO 10 BY -1 DO ...      (* fires, negative step, start < end *)
```

**Not a trigger.** Valid descending loops are recognised as such, including non-literal step forms:

```pascal
FOR i := 10 TO 1 BY -2 DO ...      (* quiet — valid descending loop *)
FOR i := 10 TO 1 BY (-2) DO ...    (* quiet *)
FOR i := 10 TO 1 BY -STEP DO ...   (* quiet, assuming STEP is a positive constant *)
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

