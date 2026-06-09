(*
 * Globals for the conveyor demo.
 *
 * Demonstrates VAR_GLOBAL CONSTANT (constants the engine watches), a
 * non-constant global (typed reference for callers), and several IEC
 * 62443 cybersecurity anti-patterns at the end (intentional fixture
 * content — do not copy).
 *)

VAR_GLOBAL CONSTANT
    SAFETY_TIMEOUT      : TIME := T#10s;
    LIMIT_MAX_SPEED     : INT  := 250;
    LIMIT_MIN_SPEED     : INT  := 5;
    CONVEYOR_SLOTS      : INT  := 10;
END_VAR

VAR_GLOBAL
    gFlowSetpoint       : INT  := 0;
END_VAR

(*
 * IEC 62443 anti-patterns — these all fire deliberately on the demo PR:
 *   HARDCODED_CREDENTIALS       — sAdminPassword literal STRING
 *   HARDCODED_NETWORK_ENDPOINT  — sScadaHost literal IPv4
 *)
VAR_GLOBAL
    sAdminPassword      : STRING := 'P@ssw0rd123!';
    sScadaHost          : STRING := '10.40.12.5';
END_VAR

(*
 * PERSISTENT_PLAINTEXT_SECRET — secret-named RETAIN global is readable
 * across power cycles from the engineering tool. Should be loaded at
 * startup from a key store, not baked into NV storage.
 *)
VAR_GLOBAL RETAIN
    sApiToken           : STRING;
END_VAR

(*
 * Twelve more globals — exist so FB_Insecure's POU can reference > 10
 * distinct globals and trip TOO_MANY_GLOBALS_USED (PLCopen CP18 cap = 10).
 *)
VAR_GLOBAL
    gGlobal01 : INT := 0;
    gGlobal02 : INT := 0;
    gGlobal03 : INT := 0;
    gGlobal04 : INT := 0;
    gGlobal05 : INT := 0;
    gGlobal06 : INT := 0;
    gGlobal07 : INT := 0;
    gGlobal08 : INT := 0;
    gGlobal09 : INT := 0;
    gGlobal10 : INT := 0;
    gGlobal11 : INT := 0;
    gGlobal12 : INT := 0;
END_VAR
