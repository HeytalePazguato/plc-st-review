(*
 * E_DiagMode — diagnostic verbosity levels for FB_AxisRamp.
 *
 * This revision removes DIAG_LEGACY (ENUM_VALUE_REMOVED). DIAG_VERBOSE
 * is kept here but its CASE branch in FB_AxisRamp is dropped, so it
 * also surfaces ENUM_VALUE_UNUSED.
 *)

TYPE E_DiagMode :
    (DIAG_OFF := 0, DIAG_BASIC, DIAG_VERBOSE);
END_TYPE
