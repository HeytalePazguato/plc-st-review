(*
 * I_Diagnostic — diagnostic contract implemented by FB_DiagUnit.
 *
 * The demo PR adds a second method (SelfTest) to this interface without
 * adding it to the implementer, surfacing METHOD_ADDED_TO_INTERFACE.
 *)

INTERFACE I_Diagnostic
METHOD Reset : BOOL
END_METHOD
END_INTERFACE
