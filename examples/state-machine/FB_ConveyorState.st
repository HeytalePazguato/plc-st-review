(*
 * FB_ConveyorState — minimal conveyor state machine.
 *
 * Implements a Mealy-style state machine over E_ConveyorState, with a
 * startup-delay timer and a configurable target speed. Designed to exercise
 * several plc-st-review checks at once when the file is edited.
 *)

FUNCTION_BLOCK FB_ConveyorState
VAR_INPUT
    xEnable             : BOOL;
    rTargetSpeed        : REAL;
    iPulseCount         : INT;
    xManualOverride     : BOOL;
END_VAR
VAR_OUTPUT
    eState              : E_ConveyorState;
    xRunning            : BOOL;
    rActualSpeed        : REAL;
END_VAR
VAR
    T_StartupDelay      : TON;
    T_FaultHold         : TON;
    fbRamp              : FB_AxisRamp;
    fbSpeed             : FB_SpeedCalculator;
    fbDiag              : FB_DiagUnit;
    fbMetrics           : FB_MetricsDemo;
    iRamp               : INT;
END_VAR

(* Sub-blocks run every scan; their outputs feed the state logic below. *)
T_StartupDelay(IN := (eState = E_ConveyorState.STARTING), PT := T#200ms);
fbSpeed(iPulseCount := iPulseCount, rScale := 0.5);
fbDiag();

CASE eState OF
    E_ConveyorState.IDLE:
        IF xEnable AND NOT xManualOverride THEN
            IF rTargetSpeed > 0.0 AND rTargetSpeed <= LIMIT_MAX_SPEED THEN
                eState := E_ConveyorState.STARTING;
            ELSIF rTargetSpeed > LIMIT_MAX_SPEED THEN
                eState := E_ConveyorState.FAULT;
            END_IF;
        END_IF;

    E_ConveyorState.STARTING:
        IF T_StartupDelay.Q THEN
            eState := E_ConveyorState.RUNNING;
            rActualSpeed := 0.0;
        END_IF;

    E_ConveyorState.RUNNING:
        xRunning := TRUE;
        fbRamp(rSetpoint := rTargetSpeed, eMode := E_DiagMode.DIAG_BASIC, xCount := xEnable);
        (* Ramp toward target, clamped per slot, bailing out on disable / fault. *)
        FOR iRamp := 1 TO 100 BY 1 DO
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
        IF NOT xEnable THEN
            eState := E_ConveyorState.STOPPING;
        END_IF;

    E_ConveyorState.STOPPING:
        xRunning := FALSE;
        rActualSpeed := 0.0;
        eState := E_ConveyorState.IDLE;

    E_ConveyorState.FAULT:
        xRunning := FALSE;
        rActualSpeed := 0.0;
END_CASE;

END_FUNCTION_BLOCK
