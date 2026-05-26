(*
 * FB_DiagUnit — implements I_Diagnostic.
 *
 * The demo PR adds a SelfTest method to I_Diagnostic; this FB does NOT
 * gain a matching method, surfacing METHOD_ADDED_TO_INTERFACE.
 *)

FUNCTION_BLOCK FB_DiagUnit IMPLEMENTS I_Diagnostic
VAR
    xReady : BOOL;
END_VAR

METHOD Reset : BOOL
    xReady := FALSE;
    Reset := TRUE;
END_METHOD

xReady := TRUE;
END_FUNCTION_BLOCK
