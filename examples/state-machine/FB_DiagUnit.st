(*
 * FB_DiagUnit — implements I_Diagnostic.
 *
 * The demo PR adds a SelfTest method to I_Diagnostic; this FB does NOT
 * gain a matching method, surfacing METHOD_ADDED_TO_INTERFACE.
 *
 * EXTENDS FB_BaseV2 so the v2 base is reachable through inheritance: the
 * metrics call graph credits an EXTENDS target as used, keeping base classes
 * off the dead-code list.
 *)

FUNCTION_BLOCK FB_DiagUnit EXTENDS FB_BaseV2 IMPLEMENTS I_Diagnostic
VAR
    xReady : BOOL;
END_VAR

METHOD Reset : BOOL
    xReady := FALSE;
    Reset := TRUE;
END_METHOD

xReady := TRUE;
END_FUNCTION_BLOCK
