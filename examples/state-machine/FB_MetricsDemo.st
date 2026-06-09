// Expanded version of the metrics-demo block. Against the simple baseline on
// the base branch, this exercises the metric-regression checks:
// COMPLEXITY_INCREASED (1 -> 11), NESTING_INCREASED (0 -> 6), and LOC_SPIKE.
FUNCTION_BLOCK FB_MetricsDemo
VAR_INPUT
    x : INT;
    mode : INT;
    enable : BOOL;
END_VAR
VAR_OUTPUT
    y : INT;
END_VAR
VAR
    i : INT;
END_VAR
IF enable THEN
    IF mode = 0 THEN
        IF x > 0 THEN
            FOR i := 0 TO 10 DO
                WHILE x > i DO
                    IF x > 100 THEN
                        y := 1;
                    ELSIF x > 50 THEN
                        y := 2;
                    ELSE
                        y := 3;
                    END_IF;
                END_WHILE;
            END_FOR;
        ELSIF x < 0 THEN
            y := -1;
        END_IF;
    ELSIF mode = 1 THEN
        y := 10;
    ELSIF mode = 2 THEN
        y := 20;
    ELSE
        y := 0;
    END_IF;
END_IF;
END_FUNCTION_BLOCK
