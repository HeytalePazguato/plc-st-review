(*
 * I_Diagnostic — diagnostic contract implemented by FB_DiagUnit.
 *
 * This revision adds a second method (SelfTest). FB_DiagUnit does NOT
 * gain a matching method, which plc-st-review flags as
 * METHOD_ADDED_TO_INTERFACE.
 *)

INTERFACE I_Diagnostic
METHOD Reset : BOOL
END_METHOD

METHOD SelfTest : BOOL
END_METHOD
END_INTERFACE
