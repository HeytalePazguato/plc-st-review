# COMPLEXITY_INCREASED

**Severity:** `warn` (default) / `error` (new value crosses the error threshold)

A POU's cyclomatic complexity rose between the *before* and *after* trees. Complexity is McCabe's count adapted for ST: 1, plus 1 for each `IF`, `ELSIF`, `FOR`, `WHILE`, `REPEAT`, each `CASE` arm, and each `AND` / `OR` in a condition.

**Why it matters.** A POU that gains many decision points in one PR is harder to test and review than the diff line count suggests. Catching the jump on the PR keeps complexity from creeping up unnoticed.

**Settings.** Reads `metrics.thresholds.cyclomatic_complexity` from `.plc-st-review.yml`:

```yaml
metrics:
  thresholds:
    cyclomatic_complexity:
      warn: 15
      error: 25
```

Warns on any increase greater than 5. Escalates to `error` when the new value reaches the `error` band and the old value was below it (a freshly crossed threshold). Smaller increases that stay below both bars are not reported.

**Trigger.**

```pascal
(* before: complexity 8 *)
(* after: an added ELSIF chain pushes it to 31 *)
```

**The bot posts.**

```
🟥 error  COMPLEXITY_INCREASED
FB_MainSequence cyclomatic complexity: 22 → 31 (crossed error threshold of 25)
```

**Fix.** Extract the new branching into a method, replace a long `IF`/`ELSIF` ladder with a `CASE`, or split the POU. If the growth is justified, raise the threshold or suppress per-file.
