(*
 * Conveyor state machine enum.
 *
 * Used by FB_ConveyorState and (separately) by Conveyor_HMI. If we add a
 * value here and forget to handle it in the HMI's CASE, plc-st-review will
 * surface STATE_UNHANDLED.
 *)

TYPE E_ConveyorState :
    (IDLE := 0, STARTING, RUNNING, STOPPING, FAULT);
END_TYPE
