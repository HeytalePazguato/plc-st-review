(*
 * FB_Legacy — a deprecated helper kept only so the demo PR can delete
 * the whole file and surface POU_DELETED. Nothing calls it.
 *)

FUNCTION_BLOCK FB_Legacy
VAR_INPUT
    xTrigger : BOOL;
END_VAR
VAR_OUTPUT
    xDone : BOOL;
END_VAR
xDone := xTrigger;
END_FUNCTION_BLOCK
