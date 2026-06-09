(*
 * FB_SpeedCalculator — converts a raw pulse count to a speed estimate.
 *
 * Renamed from FB_SpeedCalc (the input/output signature is unchanged),
 * which is what plc-st-review flags as POU_RENAMED.
 *)

FUNCTION_BLOCK FB_SpeedCalculator
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
