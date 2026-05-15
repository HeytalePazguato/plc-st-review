(*
 * E_DiagMode — diagnostic verbosity levels for FB_AxisRamp.
 *
 * The demo PR removes DIAG_LEGACY (ENUM_VALUE_REMOVED) and drops the
 * DIAG_VERBOSE branch from FB_AxisRamp's CASE while keeping the value
 * in the enum (ENUM_VALUE_UNUSED).
 *)

TYPE E_DiagMode :
    (DIAG_OFF := 0, DIAG_BASIC, DIAG_VERBOSE, DIAG_LEGACY);
END_TYPE
