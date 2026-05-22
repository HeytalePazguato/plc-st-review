// Baseline version of the metrics-demo block. The demo PR (#1) ships a
// heavily expanded version of this same FB, so the diff exercises the
// metric-regression checks (COMPLEXITY_INCREASED, NESTING_INCREASED,
// LOC_SPIKE) without disturbing any other fixture.
FUNCTION_BLOCK FB_MetricsDemo
VAR_INPUT
    x : INT;
END_VAR
VAR_OUTPUT
    y : INT;
END_VAR
y := x;
END_FUNCTION_BLOCK
