(*
 * FB_Insecure — deliberately bug-riddled fixture used to exercise the
 * IEC 62443 cybersecurity checks plus the limit-gated and pointer-flavored
 * PLCopen rules that the rest of the demo doesn't cover.
 *
 * IEC 62443 triggers (file-level + body):
 *   DEBUG_PRAGMA_IN_PRODUCTION  — file-leading `{attribute 'monitoring'}`
 *   UNVALIDATED_INPUT_USE       — VAR_INPUT idx used as arr[idx], no guard
 *
 * PLCopen rule triggers added on this revision:
 *   FORBIDDEN_STATEMENT         — GOTO statement (L10)
 *   FOR_LOOP_VAR_MODIFIED       — assignment to loop counter inside body (L12)
 *   FOR_LOOP_VAR_USED_AFTER     — read of loop counter after END_FOR (L13)
 *   POINTER_ARITHMETIC          — `pSrc + 1` on a POINTER local (E2)
 *   POINTER_COMPARED            — `pSrc > pDst` on POINTER locals (E3)
 *   UNINITIALIZED_VAR_USED      — local read before any assignment (CP3)
 *   TIME_EQUALITY               — `=` on TIME operands (CP28)
 *   IMPLICIT_TYPE_CONVERSION    — INT + REAL in arithmetic without cast (CP25)
 *   EXTERNAL_VAR_IN_FUNCTION    — VAR_EXTERNAL inside FUNCTION_BLOCK (CP6)
 *   IDENTIFIER_TOO_LONG         — identifier longer than 32 chars (N6)
 *   IDENTIFIER_CHARSET          — identifier with chars outside the
 *                                  IEC ASCII letter / digit / underscore
 *                                  regex set by the PLCopen preset (N8)
 *   TOO_MANY_PARAMETERS         — POU with > 8 declared parameters (CP23)
 *   TOO_MANY_GLOBALS_USED       — POU touching > 10 distinct globals (CP18)
 *   DIRECT_ADDRESS_USED         — `%I0.0` / `%Q0.1` references (N1 / CP1)
 *   NAME_REUSED_DIFFERENT_KIND  — name `IDLE` reused across decl kinds (N9)
 *
 * Do not copy this code anywhere real.
 *)

{attribute 'monitoring' := 'variable'}
FUNCTION_BLOCK FB_Insecure
VAR_INPUT
    idx     : INT;
    rIn     : REAL;
    iCount  : INT;
END_VAR
VAR
    arr     : ARRAY [0..9] OF INT;
    pSrc    : POINTER TO INT;
    pDst    : POINTER TO INT;
    iAfter  : INT;
    iLoop   : INT;
    iSum    : INT;
    rOut    : REAL;
    tA      : TIME;
    tB      : TIME;
    xCmp    : BOOL;
    xButton : BOOL;
    xLatch  : BOOL;
    iLater  : INT;
    (* IDENTIFIER_TOO_LONG — 53 chars, > PLCopen N6 cap of 32. *)
    rThisIdentifierIsDeliberatelyLongerThanThirtyTwoChars : REAL;
    (* IDENTIFIER_CHARSET — `__` (double underscore) is forbidden by the
       demo config's tightened `identifier_charset` regex. *)
    iCount__double_underscore : INT;
END_VAR
VAR_EXTERNAL
    gFlowSetpoint : INT;
END_VAR

(* DIRECT_ADDRESS_USED — physical I/O references; PLCopen N1 / CP1 *)
xButton := %I0.0;
%Q0.1   := xButton;

(* UNVALIDATED_INPUT_USE — VAR_INPUT idx used as array subscript with no
   relational guard anywhere in this POU. *)
arr[idx] := 1;

(* FOR_LOOP_VAR_MODIFIED + FOR_LOOP_VAR_USED_AFTER + FORBIDDEN_STATEMENT.
   `iLoop` is the loop counter; assigning it inside the body and reading
   it after END_FOR are both L12 / L13 violations. GOTO is L10. *)
FOR iLoop := 1 TO 10 BY 1 DO
    iLoop := iLoop + 2;             (* FOR_LOOP_VAR_MODIFIED *)
    iSum  := iSum + iLoop;
    IF iSum > 1000 THEN
        GOTO done;                  (* FORBIDDEN_STATEMENT *)
    END_IF;
END_FOR;
done:
iAfter := iLoop;                    (* FOR_LOOP_VAR_USED_AFTER *)

(* POINTER_ARITHMETIC + POINTER_COMPARED — both forbidden in PLCopen E2 / E3. *)
pSrc := pSrc + 1;
xCmp := pSrc > pDst;

(* TIME_EQUALITY — brittle on tick-based runtimes; PLCopen CP28. *)
IF tA = tB THEN
    xLatch := TRUE;
END_IF;

(* IMPLICIT_TYPE_CONVERSION — INT mixed with REAL in arithmetic; PLCopen CP25. *)
rOut := rIn + iCount;

(* UNINITIALIZED_VAR_USED — `iLater` is read before any assignment;
   the value is implementation-defined (PLCopen CP3). *)
iSum := iSum + iLater;

(* TOO_MANY_GLOBALS_USED — touches > 10 distinct global names in this POU.
   The PLCopen preset caps `max_globals_used_per_pou` at 10 (CP18). *)
iSum := iSum
      + gGlobal01 + gGlobal02 + gGlobal03 + gGlobal04
      + gGlobal05 + gGlobal06 + gGlobal07 + gGlobal08
      + gGlobal09 + gGlobal10 + gGlobal11 + gGlobal12;

(* IDENTIFIER_TOO_LONG + IDENTIFIER_CHARSET — both fire on these locals. *)
rOut := rThisIdentifierIsDeliberatelyLongerThanThirtyTwoChars;
iSum := iCount__double_underscore;

END_FUNCTION_BLOCK

(* TOO_MANY_PARAMETERS — > 8 parameters across inputs/outputs/in_outs;
   PLCopen CP23 caps at 8 by default. *)
FUNCTION_BLOCK FB_TooManyParams
VAR_INPUT
    iA  : INT;
    iB  : INT;
    iC  : INT;
    iD  : INT;
    iE  : INT;
    iF  : INT;
    iG  : INT;
    iH  : INT;
    iI  : INT;
END_VAR
VAR_OUTPUT
    iOut : INT;
END_VAR
iOut := iA + iB + iC + iD + iE + iF + iG + iH + iI;
END_FUNCTION_BLOCK

(* IDENTIFIER_CHARSET fires on FB_Insecure's `iCount__double_underscore`
   above. The demo config tightens PLCopen N8's regex to forbid
   consecutive underscores (`(?!.*__)`). *)

(* NAME_REUSED_DIFFERENT_KIND — the name `IDLE` exists as an enum value
   in E_ConveyorState; declaring a same-named global of a different kind
   collides under PLCopen N9. *)
VAR_GLOBAL
    IDLE : INT := 0;
END_VAR
