# TIMER_VALUE_CHANGED

**Severity:** `info` / `warn` (≥ 2×) / `error` (≥ 10×)

A `TON` / `TOF` / `TP` `PT` value changed between revisions. Severity
scales with the magnitude of the change.

**Why it matters.** Timer changes are easy to miss in code review
because they look like trivial literal edits, but a 10× faster PT can
turn a safety debounce into a flicker. The scaled severity makes the
"oh that's just 200ms" change loud when it actually matters.

**Settings.**

```yaml
severity_overrides:
  TIMER_VALUE_CHANGED: error   # block merge on any timer change
```

**Trigger.**

```pascal
T_StartupDelay(IN := TRUE, PT := T#5s);     (* before *)
T_StartupDelay(IN := TRUE, PT := T#500ms);  (* after *)
```

**The bot posts.**

```
🟥 error  TIMER_VALUE_CHANGED
Timer T_StartupDelay.PT: T#5s → T#500ms (10.0x faster)
Ratio after/before ≈ 0.100. Confirm the change was intentional.
```

**Fix.** Confirm the new value is the intended one. If you're tuning,
mention the rationale in the PR description. If unintended, revert.
