(*
 * FB_Diagnostics — deliberately bug-riddled. Used to exercise every
 * single-revision check that plc-st-review ships with.
 *
 * Engine-level triggers:
 *   ARRAY_INDEX_OUT_OF_BOUNDS     arr[15] when arr is [0..9]
 *   DIVISION_BY_ZERO              rResult := rInput / 0
 *   INFINITE_LOOP                 WHILE TRUE with no EXIT
 *   LOOP_BOUNDS_REVERSED          FOR i := 10 TO 5 BY 1
 *   ENUM_MEMBER_UNKNOWN           E_ConveyorState.IDEL — typo
 *
 * FB-instance triggers:
 *   TIMER_PT_ZERO                 TON(PT := T#0s)
 *   TIMER_NOT_DRIVEN              T2.Q read but no call sets IN
 *   COUNTER_PV_ZERO               CTU(PV := 0)
 *   EDGE_TRIG_REUSED              one R_TRIG fed by two CLK signals
 *   FB_INSTANCE_DOUBLE_CALL       T1 called twice in one scope
 *   FB_INSTANCE_NEVER_CALLED      T3 has its Q read but is never invoked
 *   BISTABLE_DOMINANCE_MISMATCH   eStopLatch : SR (name suggests RS)
 *
 * Code-quality / style triggers added on this revision:
 *   EMPTY_STATEMENT               lone `;`
 *   ARRAY_SINGLE_ELEMENT          ARRAY [5..5]
 *   VARIABLE_SHADOWING            local 'gFlowSetpoint' hides the global
 *   UNUSED_INPUT_VAR              xUnusedInput is declared but never read
 *   INPUT_VAR_WRITTEN             rInput is assigned below
 *   BOOL_COMPARISON               IF xButton = TRUE
 *   REAL_EQUALITY                 IF rInput = 0.5
 *   MULTIPLE_EXIT_POINTS          two RETURN statements
 *   ASSIGNMENT_IN_CONDITION       IF iCounter := 0 THEN
 *   COMMENTED_OUT_CODE            commented-out assignment
 *   RECURSIVE_CALL                FB_Diagnostics calling itself
 *   ADDRESS_OF_CONSTANT           ADR(SAFETY_TIMEOUT)
 *   UNUSED_OUTPUT_VAR             xUnusedOutput declared but never written
 *   OUTPUT_VAR_READ_INTERNALLY    rResult read inside the same POU
 *   NESTED_COMMENTS               (* outer (* nested *) *)
 *   UNUSED_RETURN_VALUE           Compute() called as a bare statement
 *   IDENTIFIER_CASE_MISMATCH      ICOUNTER used (declared as iCounter)
 *   NAMING_CONVENTION             T1/T2/T3/C1/rTrig1/eStopLatch lack fb prefix;
 *                                 Compute lacks fn prefix (rules in .plc-st-review.yml)
 *
 * Config / signature triggers:
 *   CALL_SITE_OUTDATED            fbHelper(...) omits required input xSecondary
 *   FORBIDDEN_SYMBOL              gDeprecatedSpeed is on the .plc-st-review.yml
 *                                 forbidden_symbols blocklist
 *
 * Do not copy this code anywhere real.
 *)

FUNCTION Compute : INT
    Compute := 42;
END_FUNCTION

FUNCTION_BLOCK FB_Helper
VAR_INPUT
    xPrimary   : BOOL;
    xSecondary : BOOL;
END_VAR
VAR_OUTPUT
    xOut : BOOL;
END_VAR
xOut := xPrimary AND xSecondary;
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_Diagnostics
VAR_INPUT
    rInput          : REAL;
    xButton         : BOOL;
    xSensor         : BOOL;
    xUnusedInput    : BOOL;
END_VAR
VAR_OUTPUT
    rResult         : REAL;
    eFakeState      : E_ConveyorState;
    xEdge           : BOOL;
    xLatched        : BOOL;
    xUnusedOutput   : BOOL;
END_VAR
VAR
    arr             : ARRAY [0..9] OF INT;
    arrSingle       : ARRAY [5..5] OF INT;
    i               : INT;
    iCounter        : INT;
    gFlowSetpoint   : REAL;
    T1              : TON;
    T2              : TON;
    T3              : TON;
    C1              : CTU;
    rTrig1          : R_TRIG;
    eStopLatch      : SR;
    fbSelf          : FB_Diagnostics;
    fbHelper        : FB_Helper;
END_VAR

(* ARRAY_INDEX_OUT_OF_BOUNDS *)
arr[15] := 1;

(* DIVISION_BY_ZERO *)
rResult := rInput / 0;

(* OUTPUT_VAR_READ_INTERNALLY: rResult is read on the next line *)
rResult := rResult + 1.0;

(* INPUT_VAR_WRITTEN: assigning to a VAR_INPUT *)
rInput := 0.0;

(* BOOL_COMPARISON *)
IF xButton = TRUE THEN
    ;                                  (* EMPTY_STATEMENT *)
END_IF;

(* REAL_EQUALITY *)
IF rInput = 0.5 THEN
    iCounter := 1;
END_IF;

(* ASSIGNMENT_IN_CONDITION *)
IF iCounter := 0 THEN
    iCounter := iCounter + 1;
END_IF;

(* IDENTIFIER_CASE_MISMATCH: ICOUNTER vs iCounter *)
ICOUNTER := ICOUNTER + 1;

(* LOOP_BOUNDS_REVERSED *)
FOR i := 10 TO 5 BY 1 DO
    iCounter := iCounter + 1;
END_FOR;

(* INFINITE_LOOP *)
WHILE TRUE DO
    iCounter := iCounter + 1;
END_WHILE;

(* ENUM_MEMBER_UNKNOWN *)
eFakeState := E_ConveyorState.IDEL;

(* TIMER_PT_ZERO + FB_INSTANCE_DOUBLE_CALL: T1 invoked twice with PT=0 *)
T1(IN := xButton, PT := T#0s);
T1(IN := xSensor, PT := T#0s);

(* TIMER_NOT_DRIVEN: T2 called without IN, then Q is read *)
T2(PT := T#5s);
xLatched := T2.Q;

(* FB_INSTANCE_NEVER_CALLED: T3 read but never invoked *)
xEdge := T3.Q;

(* COUNTER_PV_ZERO *)
C1(CU := xButton, PV := 0);

(* EDGE_TRIG_REUSED: same R_TRIG, two different CLK *)
rTrig1(CLK := xButton);
rTrig1(CLK := xSensor);

(* BISTABLE_DOMINANCE_MISMATCH: name suggests reset-dominant, type is SR *)
eStopLatch(SET1 := FALSE, RESET := FALSE);

(* ADDRESS_OF_CONSTANT: SAFETY_TIMEOUT is a VAR_GLOBAL CONSTANT *)
i := ADR(SAFETY_TIMEOUT);

(* UNUSED_RETURN_VALUE: function call as bare statement *)
Compute();

(* RECURSIVE_CALL: FB invokes its own type *)
fbSelf();

(* CALL_SITE_OUTDATED: FB_Helper requires xPrimary AND xSecondary *)
fbHelper(xPrimary := TRUE);

(* FORBIDDEN_SYMBOL: gDeprecatedSpeed is on the configured blocklist *)
rResult := gDeprecatedSpeed;

(* COMMENTED_OUT_CODE *)
(* gFlowSetpoint := 50.0; *)

(* NESTED_COMMENTS *)
(* outer comment (* nested block *) closer *)

(* First RETURN *)
RETURN;

(* MULTIPLE_EXIT_POINTS: a second RETURN below *)
iCounter := 99;
RETURN;

END_FUNCTION_BLOCK
