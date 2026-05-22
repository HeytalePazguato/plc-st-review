# COUNTER_VALUE_CHANGED

**Severity:** `info` / `warn` (≥ 2×) / `error` (≥ 10×)

`CTU` / `CTD` / `CTUD` `PV` (preset value) changed between revisions. Severity scales with the magnitude of the change, like `TIMER_VALUE_CHANGED`.

**Why it matters.** Counters define trip points (max retries, batch size, fault thresholds). Bumping `PV` from 3 to 30 changes the machine's behavior on day one of production.

**Settings.** No check-specific config.

**Trigger.**

```pascal
C1(CU := xPulse, PV := 10);    (* before *)
C1(CU := xPulse, PV := 100);   (* after, 10× *)
```

**The bot posts.**

```
🟥 error  COUNTER_VALUE_CHANGED
Counter C1.PV: 10 → 100 (10.00×)
Magnitude ratio 10.000. Counter trips later as a result.
```

**Fix.** Confirm the new preset is intended. Document the rationale in the PR.

