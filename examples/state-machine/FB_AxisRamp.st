{attribute 'qualified_only'}
(*
 * FB_AxisRamp — ramps an axis toward a setpoint and counts cycles.
 *
 * The demo PR exercises five diff-based checks against this file:
 *   PRAGMA_CHANGED         the {attribute} pragma is swapped
 *   INHERITANCE_CHANGED    EXTENDS FB_Base -> FB_BaseV2
 *   ARRAY_BOUNDS_CHANGED   aHistory grows from [0..9] to [0..19]
 *   COUNTER_VALUE_CHANGED  cCycles.PV 100 -> 500
 *   ENUM_VALUE_UNUSED      the DIAG_VERBOSE CASE branch is removed
 *)

FUNCTION_BLOCK FB_AxisRamp EXTENDS FB_Base
VAR_INPUT
    rSetpoint : REAL;
    eMode     : E_DiagMode;
    xCount    : BOOL;
END_VAR
VAR_OUTPUT
    rPosition : REAL;
END_VAR
VAR
    aHistory  : ARRAY [0..9] OF REAL;
    cCycles   : CTU;
    iIndex    : INT;
END_VAR

cCycles(CU := xCount, PV := 100);

CASE eMode OF
    E_DiagMode.DIAG_OFF:
        rPosition := rSetpoint;
    E_DiagMode.DIAG_BASIC:
        rPosition := rSetpoint * 0.5;
    E_DiagMode.DIAG_VERBOSE:
        rPosition := rSetpoint * 0.25;
    E_DiagMode.DIAG_LEGACY:
        rPosition := 0.0;
END_CASE;

aHistory[iIndex] := rSetpoint;
END_FUNCTION_BLOCK
