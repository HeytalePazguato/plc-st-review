(*
 * FB_LineController - top-level conveyor-line coordinator.
 *
 * A deliberately involved orchestrator: it sequences the axis ramp, the speed
 * estimate, the diagnostic unit and the metrics helper behind layered mode and
 * guard logic. It exists so the --metrics report has a realistic
 * high-complexity hub to rank (it lands in the red band), and so the blocks it
 * drives are reported as live rather than dead code. The body is intentionally
 * tangled but otherwise clean - it triggers no review findings on its own.
 *)

FUNCTION_BLOCK FB_LineController EXTENDS FB_BaseV2
VAR_INPUT
    xRun        : BOOL;
    iMode       : INT;
    rSetpoint   : REAL;
    iPulses     : INT;
    xManual     : BOOL;
END_VAR
VAR_OUTPUT
    rLineSpeed  : REAL;
    xActive     : BOOL;
    iFaultCode  : INT;
END_VAR
VAR
    fbRamp      : FB_AxisRamp;
    fbSpeed     : FB_SpeedCalc;
    fbDiag      : FB_DiagUnit;
    fbMetrics   : FB_MetricsDemo;
    T_Settle    : TON;
    rLocalSpeed : REAL;
    iStep       : INT;
    iGuard      : INT;
    iFault      : INT;
END_VAR

(* Sub-blocks run every scan; their outputs feed the mode logic below. *)
fbSpeed(iPulseCount := iPulses, rScale := 0.5);
fbDiag();
T_Settle(IN := xRun, PT := T#500ms);

CASE iMode OF
    0:  (* idle - wait for a run request that isn't a manual hold *)
        IF xRun AND NOT xManual THEN
            iStep := 1;
        ELSIF xManual THEN
            iStep := 0;
        END_IF;

    1:  (* ramping - climb toward setpoint once the settle timer elapses *)
        IF T_Settle.Q THEN
            fbRamp(rSetpoint := rSetpoint, eMode := E_DiagMode.DIAG_BASIC, xCount := xRun);
            FOR iGuard := 1 TO CONVEYOR_SLOTS BY 1 DO
                IF fbSpeed.rSpeed > rLocalSpeed THEN
                    rLocalSpeed := rLocalSpeed + (rSetpoint - rLocalSpeed) * 0.1;
                    IF rLocalSpeed > LIMIT_MAX_SPEED THEN
                        rLocalSpeed := LIMIT_MAX_SPEED;
                    END_IF;
                    IF xManual OR iGuard > LIMIT_MIN_SPEED THEN
                        iStep := iGuard;
                    END_IF;
                END_IF;
            END_FOR;
        END_IF;

    2:  (* running - advance the line, sampling metrics as it goes *)
        WHILE iStep < CONVEYOR_SLOTS AND xRun DO
            iStep := iStep + 1;
            IF rLocalSpeed >= rSetpoint THEN
                EXIT;
            END_IF;
            IF iStep >= LIMIT_MIN_SPEED THEN
                fbMetrics(x := iStep);
                IF fbMetrics.y > 0 OR xManual THEN
                    rLocalSpeed := fbRamp.rPosition;
                END_IF;
            END_IF;
        END_WHILE;

    3:  (* diagnostics - classify the speed estimate into a fault code *)
        IF fbSpeed.rSpeed < LIMIT_MIN_SPEED THEN
            iFault := 1;
        ELSIF fbSpeed.rSpeed > LIMIT_MAX_SPEED THEN
            iFault := 2;
        ELSE
            iFault := 0;
        END_IF;

    4:  (* hold - manual override parks the line *)
        IF xManual THEN
            iStep := 0;
            rLocalSpeed := 0.0;
        END_IF;

    ELSE
        iStep := 0;
END_CASE;

IF iFault > 0 THEN
    xActive := FALSE;
ELSIF xRun THEN
    xActive := TRUE;
END_IF;

rLineSpeed := rLocalSpeed;
iFaultCode := iFault;
END_FUNCTION_BLOCK
