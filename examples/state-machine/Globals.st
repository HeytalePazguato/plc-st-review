(*
 * Globals for the conveyor demo.
 *
 * Demonstrates VAR_GLOBAL CONSTANT (constants the engine watches) and a
 * non-constant global (typed reference for callers).
 *)

VAR_GLOBAL CONSTANT
    SAFETY_TIMEOUT      : TIME := T#2s;
    LIMIT_MAX_SPEED     : INT  := 100;
    LIMIT_MIN_SPEED     : INT  := 5;
    CONVEYOR_SLOTS      : INT  := 10;
END_VAR

VAR_GLOBAL
    gFlowSetpoint       : REAL := 0.0;
END_VAR
