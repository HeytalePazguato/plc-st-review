(*
 * FB_Watchdog — trivial heartbeat monitor.
 *
 * The demo PR changes ONLY the inline comment below, leaving the AST
 * structurally identical between revisions, to surface COMMENT_ONLY.
 *)

FUNCTION_BLOCK FB_Watchdog
VAR_INPUT
    xHeartbeat : BOOL;
END_VAR
VAR_OUTPUT
    xAlive : BOOL;
END_VAR
(* forward the heartbeat signal directly to the alive output *)
xAlive := xHeartbeat;
END_FUNCTION_BLOCK
