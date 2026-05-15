(*
 * FB_Base / FB_BaseV2 — base classes for the diagnostics demo.
 *
 * FB_AxisRamp EXTENDS FB_Base here; the demo PR re-points it at
 * FB_BaseV2 to surface INHERITANCE_CHANGED. Both are deliberately
 * trivial — they exist only to be inherited from.
 *)

FUNCTION_BLOCK FB_Base
VAR
    xInitialized : BOOL;
END_VAR
xInitialized := TRUE;
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_BaseV2
VAR
    xInitialized : BOOL;
    iRevision    : INT;
END_VAR
xInitialized := TRUE;
iRevision := 2;
END_FUNCTION_BLOCK
