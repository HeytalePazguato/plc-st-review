# FOR_LOOP_VAR_USED_AFTER

**Severity:** `info`.
**PLCopen:** L13 — the value of a `FOR` loop counter after the loop is implementation-defined.

A reference to the loop counter appears after the `FOR` body terminates. Per IEC 61131-3 the post-loop value of the counter is not portable — it may be `end`, `end + step`, or whatever the runtime decided. Don't depend on it.

**Settings.** No check-specific config. (Heuristic: a reference more than 200 lines after the `FOR` header is treated as "after the loop"; finer-grained loop-end tracking is on the backlog.)

**Trigger.**

```pascal
FOR i := 1 TO 10 DO
    ...
END_FOR;
(* much later in the POU *)
x := i;                              (* fires — undefined value *)
```

**The bot posts.**

```
🟦 info  FOR_LOOP_VAR_USED_AFTER
FOR-loop counter 'i' read after the loop terminates (PLCopen L13)
```

**Fix.** Compute the post-loop value explicitly (e.g. assign before exiting the loop body), or use a fresh variable for the post-loop intent.
