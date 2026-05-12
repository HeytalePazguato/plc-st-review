(*
 * Conveyor_HMI — display formatter for the conveyor state machine.
 *
 * Lives in a different file than FB_ConveyorState on purpose: the engine's
 * cross-file analysis is what surfaces STATE_UNHANDLED when the enum gains
 * a value and only one of the CASE statements is updated.
 *)

PROGRAM Conveyor_HMI
VAR
    fbConveyor          : FB_ConveyorState;
    sStateLabel         : STRING := '';
END_VAR

fbConveyor(xEnable := TRUE, rTargetSpeed := 50.0);

CASE fbConveyor.eState OF
    E_ConveyorState.IDLE:       sStateLabel := 'Idle';
    E_ConveyorState.STARTING:   sStateLabel := 'Starting...';
    E_ConveyorState.RUNNING:    sStateLabel := 'Running';
    E_ConveyorState.STOPPING:   sStateLabel := 'Stopping...';
    E_ConveyorState.FAULT:      sStateLabel := 'FAULT';
END_CASE;

END_PROGRAM
