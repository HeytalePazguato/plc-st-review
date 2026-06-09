VAR_GLOBAL
    gA : INT;
    gB : INT;
    gC : INT;
    gD : INT;
    gE : INT;
    gF : INT;
    gG : INT;
    gH : INT;
    gI : INT;
    gJ : INT;
    gK : INT;
    gL : INT;
    gShared : INT;
END_VAR

FUNCTION F_Compute : INT
VAR_EXTERNAL
    gA : INT;
END_VAR
VAR
    iTmp : INT;
END_VAR
    iTmp := gA;
    // L17 — IF with no ELSE
    IF iTmp > 0 THEN
        F_Compute := 1;
        RETURN;
    END_IF;
    // CP14 — second exit point
    F_Compute := 0;
    RETURN;
END_FUNCTION

(* FB_Recursive — CP13: a POU that calls itself through a self-typed instance. *)
FUNCTION_BLOCK FB_Recursive
VAR
    fbSelf : FB_Recursive;
END_VAR
    fbSelf();
END_FUNCTION_BLOCK

(* FB_AltA — CP13 indirect: part of an A -> B -> A call cycle. *)
FUNCTION_BLOCK FB_AltA
VAR
    fbB : FB_AltB;
END_VAR
    fbB();
END_FUNCTION_BLOCK

(* FB_AltB — CP13 indirect: closes the A -> B -> A call cycle. *)
FUNCTION_BLOCK FB_AltB
VAR
    fbA : FB_AltA;
END_VAR
    fbA();
END_FUNCTION_BLOCK

(* FB_Drive — exercises the rest of the PLCopen check set. *)
FUNCTION_BLOCK FB_Drive
VAR_INPUT
    iSetpoint : INT;
    iRampUp   : INT;
    iRampDown : INT;
    iMode     : INT;
    iJogSpeed : INT;
    iMaxSpeed : INT;
END_VAR
VAR_OUTPUT
    oSpeed  : INT;
    oFault  : BOOL;
    oCount  : INT;
    oUnused : INT;
END_VAR
VAR
    pTrend  : POINTER TO INT;
    pOther  : POINTER TO INT;
    tDelay  : TIME := T#5s;
    rValue  : REAL := 0.0;
    rMix    : REAL := 0.0;
    iEarly  : INT;
    iSum    : INT := 0;
    iOffset : INT := 0;
    iLoop   : INT := 0;
    iAfter  : INT := 0;
    xSensor : BOOL := FALSE;
    xCmp    : BOOL := FALSE;
    xEq     : BOOL := FALSE;
    xTimeEq : BOOL := FALSE;
    fbTimer : TON;
    gShared : INT := 0;
    Running : BOOL := FALSE;
    iThisIdentifierIsWayTooLongForThePlcopenLimit : INT := 0;
    i__BadCharset : INT := 0;
END_VAR
    // N1 / CP1 — physical address wired straight into logic
    xSensor := %IX0.0;

    // CP3 — iEarly is read before it is ever assigned
    iAfter := iEarly;
    iEarly := iSetpoint;

    // CP25 — implicit INT -> REAL conversion in a mixed arithmetic expression
    rMix := rValue + iOffset;

    // set the pointers up, then E2 — pointer arithmetic
    pTrend := ADR(iSum);
    pOther := ADR(iAfter);
    pTrend := pTrend + iOffset;

    // E3 — relational comparison of pointers
    xCmp := pTrend > pOther;

    // CP8 — equality against a REAL literal
    xEq := rValue = 3.14;

    // CP28 — equality on a TIME value
    xTimeEq := tDelay = T#5s;

    // L17 — IF with no ELSE
    IF iMode > iMaxSpeed THEN
        oFault := TRUE;
    END_IF;

    // L10 + L12 — forbidden statements, and the loop counter modified in-body
    FOR iLoop := 1 TO iJogSpeed BY 1 DO
        iLoop := iLoop + 1;
        IF iLoop = iRampDown THEN
            CONTINUE;
        END_IF;
        IF iLoop = iSetpoint THEN
            EXIT;
        END_IF;
    END_FOR;

    // L13 — loop counter read after the loop
    iAfter := iLoop;

    // CP20 — the same FB instance called twice in one scope
    fbTimer(IN := TRUE,  PT := tDelay);
    fbTimer(IN := FALSE, PT := tDelay);

    // output read on its own right-hand side
    oCount := oCount + 1;

    // N5 / N9 — local shadows + reuses the global name gShared
    gShared := iSum;

    // a BOOL local without the PLCopen `x` prefix
    Running := TRUE;

    (* C3 — nested (* inner *) block comment *)
    iThisIdentifierIsWayTooLongForThePlcopenLimit := 0;
    i__BadCharset := 0;

    // C4 — commented-out code line
    // oSpeed := iSetpoint * 2;

    // CP18 — one POU reaching into a dozen globals
    oSpeed := gA + gB + gC + gD + gE + gF + gG + gH + gI + gJ + gK + gL;
END_FUNCTION_BLOCK
