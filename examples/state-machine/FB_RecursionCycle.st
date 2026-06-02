(*
 * FB_RecursionCycle — two POUs that mutually call each other,
 * triggering INDIRECT_RECURSIVE_CALL (PLCopen CP13 indirect).
 *
 * The engine builds the static call graph from invocation statements,
 * runs Tarjan's SCC, and reports any cycle of length >= 2 as
 * indirect recursion. RECURSIVE_CALL (direct self-call) is a separate
 * check that fires on cycles of length 1.
 *
 * Do not copy this code anywhere real.
 *)

FUNCTION_BLOCK FB_CycleA
VAR
    fbB : FB_CycleB;
END_VAR
fbB();
END_FUNCTION_BLOCK

FUNCTION_BLOCK FB_CycleB
VAR
    fbA : FB_CycleA;
END_VAR
fbA();
END_FUNCTION_BLOCK
