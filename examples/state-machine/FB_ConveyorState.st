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
END_VAR
VAR_OUTPUT
    eState              : E_ConveyorState;
    xRunning            : BOOL;
    rActualSpeed        : REAL;
END_VAR
VAR
    T_StartupDelay      : TON;
    iRamp               : INT;
END_VAR

(* Startup delay — driven by a TON instance. *)
T_StartupDelay(IN := (eState = E_ConveyorState.STARTING), PT := T#2s);

CASE eState OF
    E_ConveyorState.IDLE:
        IF xEnable THEN
            eState := E_ConveyorState.STARTING;
        END_IF;

    E_ConveyorState.STARTING:
        IF T_StartupDelay.Q THEN
            eState := E_ConveyorState.RUNNING;
            rActualSpeed := 0.0;
        END_IF;

    E_ConveyorState.RUNNING:
        xRunning := TRUE;
        (* Linear ramp toward target speed using a FOR loop. *)
        FOR iRamp := 1 TO CONVEYOR_SLOTS BY 1 DO
            rActualSpeed := rActualSpeed + (rTargetSpeed - rActualSpeed) * 0.1;
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
