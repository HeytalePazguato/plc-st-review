(*
 * FB_SpeedCalc — converts a raw pulse count to a speed estimate.
 *
 * The demo PR renames this POU to FB_SpeedCalculator (keeping the exact
 * same input/output signature) to surface POU_RENAMED.
 *)

FUNCTION_BLOCK FB_SpeedCalc
VAR_INPUT
    iPulseCount : INT;
    rScale      : REAL;
END_VAR
VAR_OUTPUT
    rSpeed      : REAL;
END_VAR
VAR
    rRaw        : REAL;
END_VAR
rRaw := rScale;
IF iPulseCount > 0 THEN
    rSpeed := rRaw;
ELSE
    rSpeed := 0.0;
END_IF;
END_FUNCTION_BLOCK
