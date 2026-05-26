(*
 * FB_ConveyorState — conveyor controller and state machine.
 *
 * The orchestrator of the demo project: it drives the axis ramp, the speed
 * estimator, the diagnostic unit and the metrics helper, so the call graph has
 * a real hub instead of a field of orphans. The body is deliberately gnarly
 * (deeply nested guards inside the RUNNING state, a fault-retry loop) so the
 * --metrics report has a genuine red outlier to point at — a controller this
 * tangled is exactly what a complexity gate is meant to catch.
 *
 * Edited by the demo PR (#1) to exercise several diff-based checks at once.
 *)

FUNCTION_BLOCK FB_ConveyorState
VAR_INPUT
    xEnable             : BOOL;
    rTargetSpeed        : REAL;
    iPulseCount         : INT;
END_VAR
VAR_OUTPUT
    eState              : E_ConveyorState;
    xRunning            : BOOL;
    rActualSpeed        : REAL;
    xFaulted            : BOOL;
END_VAR
VAR
    T_StartupDelay      : TON;
    T_FaultHold         : TON;
    fbRamp              : FB_AxisRamp;
    fbSpeed             : FB_SpeedCalc;
    fbDiag              : FB_DiagUnit;
    fbMetrics           : FB_MetricsDemo;
    iRamp               : INT;
    iRetry              : INT;
END_VAR

(* Sub-blocks run every scan; their outputs feed the state logic below. *)
T_StartupDelay(IN := (eState = E_ConveyorState.STARTING), PT := T#2s);
fbSpeed(iPulseCount := iPulseCount, rScale := 0.5);
fbDiag();

CASE eState OF
    E_ConveyorState.IDLE:
        IF xEnable THEN
            IF rTargetSpeed > 0.0 AND rTargetSpeed <= LIMIT_MAX_SPEED THEN
                eState := E_ConveyorState.STARTING;
            ELSIF rTargetSpeed > LIMIT_MAX_SPEED THEN
                eState := E_ConveyorState.FAULT;
            END_IF;
        END_IF;

    E_ConveyorState.STARTING:
        IF T_StartupDelay.Q THEN
            IF iPulseCount > 0 THEN
                eState := E_ConveyorState.RUNNING;
                rActualSpeed := 0.0;
                iRetry := 0;
            END_IF;
        END_IF;

    E_ConveyorState.RUNNING:
        xRunning := TRUE;
        fbRamp(rSetpoint := rTargetSpeed, eMode := E_DiagMode.DIAG_BASIC, xCount := xEnable);
        (* Ramp toward target, clamped per slot, bailing out on disable / fault. *)
        FOR iRamp := 1 TO CONVEYOR_SLOTS BY 1 DO
            IF fbSpeed.rSpeed > rActualSpeed THEN
                WHILE rActualSpeed < rTargetSpeed AND NOT xFaulted DO
                    rActualSpeed := rActualSpeed + (rTargetSpeed - rActualSpeed) * 0.1;
                    IF rActualSpeed >= LIMIT_MAX_SPEED THEN
                        IF NOT xEnable OR xFaulted THEN
                            EXIT;
                        END_IF;
                    END_IF;
                END_WHILE;
            END_IF;
        END_FOR;
        rActualSpeed := fbRamp.rPosition;
        IF NOT xEnable THEN
            eState := E_ConveyorState.STOPPING;
        END_IF;

    E_ConveyorState.STOPPING:
        xRunning := FALSE;
        IF rActualSpeed > 0.0 THEN
            rActualSpeed := rActualSpeed - 1.0;
        ELSIF rActualSpeed <= 0.0 THEN
            eState := E_ConveyorState.IDLE;
        END_IF;

    E_ConveyorState.FAULT:
        xFaulted := TRUE;
        xRunning := FALSE;
        rActualSpeed := 0.0;
        T_FaultHold(IN := TRUE, PT := SAFETY_TIMEOUT);
        (* Bounded auto-retry: come back to IDLE after the hold, give up after 3. *)
        IF T_FaultHold.Q THEN
            IF iRetry < 3 THEN
                iRetry := iRetry + 1;
                fbMetrics(x := iRetry);
                IF fbMetrics.y >= 0 AND xEnable THEN
                    xFaulted := FALSE;
                    eState := E_ConveyorState.IDLE;
                END_IF;
            ELSIF iRetry >= 3 THEN
                eState := E_ConveyorState.FAULT;
            END_IF;
        END_IF;
END_CASE;

END_FUNCTION_BLOCK
