# EDGE_TRIG_REUSED

**Severity:** `error`

The same `R_TRIG` / `F_TRIG` instance is invoked with two or more different `CLK` expressions across the POU.

**Why it matters.** Edge triggers hold internal state ("was CLK TRUE last scan?"). Swapping the CLK between scans scrambles the edge detection, sometimes Q fires on the wrong transition, sometimes it doesn't fire at all.

**Settings.** No check-specific config.

**Trigger.**

```pascal
rTrig(CLK := xButton);
rTrig(CLK := xSensor);             (* fires, same instance, different CLK *)
```

**The bot posts.**

```
🟥 error  EDGE_TRIG_REUSED
R_TRIG instance rTrig is reused with 2 different CLK expressions
CLK values seen: xButton, xSensor. An edge-trigger holds internal
state; mixing inputs scrambles the edge detection. Declare one
instance per CLK source.
```

**Fix.** Declare a separate `R_TRIG` / `F_TRIG` instance per input signal.
