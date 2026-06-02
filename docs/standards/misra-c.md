# MISRA-C mapping

[**MISRA-C:2012**](https://www.misra.org.uk/product/misra-c2012/) is the automotive industry's coding standard for C — ~140 numbered rules + ~17 directives covering type safety, control flow, identifiers, pointers, and language-feature restrictions. It is the most widely-cited "credibility currency" in safety-critical embedded software: when a tool says "we map our checks to MISRA-C Rule 17.2 / 15.7 / 5.3", a safety auditor reading a tool report has a familiar reference frame.

`plc-st-review` is not a C linter — it analyses IEC 61131-3 Structured Text, a different language. But many of MISRA-C's rules express the same underlying intent (no recursion, no goto, no implicit conversions, no unused parameters, no shadowing, …), so plc-st-review checks that enforce that intent in ST can be honestly mapped to the equivalent MISRA-C rule. **The mapping below is intent-based, not byte-equivalent**: it is a *credibility signal*, not a certification claim.

## What this page is — and is not

- **It is** a one-way reference: "if you live in a MISRA-C-aware codebase, here's how each plc-st-review check corresponds to the MISRA-C rule that addresses the same intent."
- **It is not** a claim that running plc-st-review makes your ST code MISRA-C compliant — the standards target different languages.
- **It is not** a certified mapping — there is no MISRA equivalent for IEC 61131-3, and no notified body audits "MISRA-aligned" tool claims.
- Many of plc-st-review's checks (timer / counter / FB-instance / diff-based / project-metric categories) cover **PLC-domain concerns C doesn't have** and have no MISRA-C analogue. Those are listed under "No direct equivalent" — that's expected, not a gap.

Rule numbers reference MISRA-C:2012 (the current edition at time of writing). MISRA-C:2023 mostly renumbers and adds; the intent-level mapping is stable.

## Naming & scope

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `IDENTIFIER_TOO_LONG` | Rule 5.1 (external identifier distinct in 31 chars) / Rule 5.4 (macro names distinct in 63 chars) | Bound identifier length so long-name collisions can't depend on truncation behaviour. |
| `IDENTIFIER_CHARSET` | Rule 4.2 (source character set) | Restrict identifiers to a defined character set so non-portable characters don't leak in. |
| `NAME_REUSED_DIFFERENT_KIND` | Rule 5.6 (typedef name uniqueness) / Rule 5.7 (tag name uniqueness) | An identifier should not serve as more than one kind of declaration in the same scope. |
| `IDENTIFIER_CASE_MISMATCH` | Rule 5.2 (identifiers distinguishable beyond case) | Two identifiers should not differ only by case in the same scope — a frequent source of typos. |
| `VARIABLE_SHADOWING` | Rule 5.3 (inner-scope identifier shall not hide outer-scope) | An inner-scope local should not silently take precedence over an outer-scope global of the same name. |
| `NAMING_CONVENTION` | Dir 4.5 (identifiers in same name space shall be typographically unambiguous) | Team-wide prefix/suffix conventions reduce read-time ambiguity. |

## Control flow & statements

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `FORBIDDEN_STATEMENT` (`GOTO`) | Rule 15.1 (no `goto`) | Unconditional jumps obstruct control-flow analysis. |
| `FORBIDDEN_STATEMENT` (`CONTINUE`) | Rule 15.3 (`continue` shall not be used) | Continue makes loop termination conditions harder to verify. |
| `FORBIDDEN_STATEMENT` (`EXIT`) | Rule 15.2 (single `break` per iteration statement) / Rule 14.2 (well-formed `for`) | Early loop exit complicates worst-case execution-time analysis. |
| `IF_WITHOUT_ELSE` | Rule 15.7 (`else if … else if …` shall be terminated with `else`) | A missing terminal `else` means there is at least one combination of inputs the author did not consider explicitly. |
| `INFINITE_LOOP` | Rule 14.2 (`for` loop shall be well-formed) | `WHILE TRUE` without `EXIT` is the ST analogue of a `for ( ; ; )` with no break. |
| `LOOP_BOUNDS_REVERSED` | Rule 14.2 (well-formed `for`) | A `FOR i := 10 TO 1 BY 1` is statically dead. |
| `STATE_UNHANDLED` | Rule 16.4 (every `switch` shall have a `default`) / Rule 16.5 (`default` shall be first/last) | `CASE` on an enum that grew a value but never gained an `ELSE` clause silently drops the new case. |
| `UNREACHABLE_CODE` | Rule 2.1 (project shall not contain unreachable code) | Code after `RETURN` / `EXIT` / `CONTINUE` cannot execute and should be removed. |
| `MULTIPLE_EXIT_POINTS` | Rule 15.5 (function should have a single point of exit) | Multiple `RETURN` paths in one POU make control-flow review harder. |
| `EMPTY_STATEMENT` | Rule 15.6 (body of an iteration / selection shall be a compound statement) | A lone `;` typically marks a paste accident, not an intentional no-op. |
| `ASSIGNMENT_IN_CONDITION` | Rule 13.4 (result of an assignment operator shall not be used) | `IF x := y THEN` is almost always a `=` / `:=` typo. |

## Types, expressions & conversions

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `IMPLICIT_TYPE_CONVERSION` | Rule 10.1 (operands shall have an appropriate essential type) / Rule 10.3 (no implicit conversion of essential type) | Mixing an `INT` and a `REAL` in arithmetic without an explicit conversion hides a precision-loss bug. |
| `BOOL_COMPARISON` | Rule 14.4 (controlling expression of an `if` shall have essentially Boolean type) | `IF xButton = TRUE` is a category error: `xButton` is already a Boolean. |
| `REAL_EQUALITY` | Dir 4.1 (run-time failures shall be minimized) | Floating-point equality is brittle by definition; use a tolerance. (MISRA-C 2012 doesn't have a numbered rule against `==` on `float`, but it is universally cited as a Dir 4.1 hazard.) |
| `DIVISION_BY_ZERO` | Dir 4.1 (run-time failures) | A literal `/ 0` (or a constant resolving to zero) is undefined behaviour at runtime. |
| `ARRAY_INDEX_OUT_OF_BOUNDS` | Rule 18.1 (pointer arithmetic shall not exceed bounds of object) | A literal index outside declared bounds is a static out-of-bounds access. |

## Pointers & references

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `POINTER_ARITHMETIC` | Rule 18.4 (`+`, `-`, `++`, `--` shall not be applied to pointer types) | Address arithmetic obstructs static reasoning about which object is accessed. |
| `POINTER_COMPARED` | Rule 18.3 (relational operators shall not be applied to pointer types unless they point into the same object) | Relational comparison of pointers from different objects is undefined behaviour. |
| `ADDRESS_OF_CONSTANT` | Rule 11.x (essential pointer conversions) — loose match | Taking the address of a `VAR_GLOBAL CONSTANT` invites accidental mutation through the resulting pointer. |

## Initialisation & unused values

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `UNINITIALIZED_VAR_USED` | Rule 9.1 (object with automatic storage duration shall be assigned before being used) | Reading a variable before any write is undefined-value behaviour. |
| `UNUSED_RETURN_VALUE` | Rule 17.7 (value returned by a non-void function shall be used) | A discarded return value usually means an error code is being ignored. |
| `UNUSED_INPUT_VAR` | Rule 2.7 (function parameter not used) | A `VAR_INPUT` that is never read is dead surface area. |
| `UNUSED_OUTPUT_VAR` | Rule 2.7 / Rule 2.3 (unused declarations) | A `VAR_OUTPUT` never written is a contract the FB doesn't honour. |
| `UNUSED_VAR_INTRODUCED` | Rule 2.3 (unused type declarations) / Rule 2.7 (unused parameters) | A new local that is never used in its scope. |

## Functions & recursion

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `RECURSIVE_CALL` | Rule 17.2 (functions shall not call themselves, either directly or indirectly) | Recursion makes worst-case stack depth unbounded and obstructs WCET analysis. |
| `INDIRECT_RECURSIVE_CALL` | Rule 17.2 (same; indirect path) | Two-or-more-POU cycle through the call graph. |

## Comments & code hygiene

| plc-st-review check | MISRA-C rule | Intent |
|---|---|---|
| `NESTED_COMMENTS` | Rule 3.1 (`/*` and `//` shall not appear inside a comment) | Nested-comment behaviour is implementation-defined and confuses readers. |
| `COMMENTED_OUT_CODE` | Dir 4.4 (sections of code should not be commented out) | Commented-out code rots in place; if it should come back, use version control. |

## No direct MISRA-C equivalent — PLC-domain checks

These categories cover concerns that don't exist in C and have no MISRA-C analogue. They are not a gap in this mapping — they're the part of plc-st-review that makes it useful for ST in the first place.

- **Timer / counter / edge / bistable patterns** (`TIMER_PT_ZERO`, `TIMER_NOT_DRIVEN`, `TIMER_VALUE_CHANGED`, `COUNTER_PV_ZERO`, `COUNTER_VALUE_CHANGED`, `EDGE_TRIG_REUSED`, `BISTABLE_DOMINANCE_MISMATCH`) — IEC 61131-3 standard function blocks; C has nothing equivalent.
- **FB-instance integrity** (`FB_INSTANCE_DOUBLE_CALL`, `FB_INSTANCE_NEVER_CALLED`) — IEC FB-instance semantics; C has no stateful function-like construct.
- **Diff-based PR checks** (`SIGNATURE_CHANGED`, `CALL_SITE_OUTDATED`, `TYPE_MISMATCH`, `ENUM_VALUE_REMOVED`, `ENUM_VALUE_ADDED`, `CONSTANT_VALUE_CHANGED`, `COMMENT_ONLY`, `ARRAY_BOUNDS_CHANGED`, `LOOP_BOUNDS_CHANGED`, `POU_DELETED`, `POU_RENAMED`, `METHOD_ADDED_TO_INTERFACE`, `INHERITANCE_CHANGED`, `PRAGMA_CHANGED`, `COUNTER_VALUE_CHANGED`, `TIMER_VALUE_CHANGED`) — these compare two revisions; MISRA-C is a single-revision rule set.
- **PLC-specific syntax** (`DIRECT_ADDRESS_USED` for `%I0.0`/`%Q1.2`) — C has no equivalent for direct I/O addresses.
- **Global-write tasking** (`MULTI_WRITER_GLOBAL`, `TOO_MANY_GLOBALS_USED`, `EXTERNAL_VAR_IN_FUNCTION`) — IEC's PROGRAM / task model; MISRA-C addresses concurrency only through Dir 4.x guidelines, no per-rule analogue.
- **Metric regressions** (`COMPLEXITY_INCREASED`, `NESTING_INCREASED`, `LOC_SPIKE`, `DEAD_POU_INTRODUCED`) — MISRA-C is advisory on complexity (Dir 4.x) but defines no specific metric thresholds.
- **Bare-config rules** (`FORBIDDEN_SYMBOL`, `NAMING_CONVENTION`) — team policy, not coded by MISRA.

## Summary

| Bucket | Count |
|---|---|
| **Mapped to a numbered MISRA-C rule (intent-level)** | ~25 |
| **Mapped to a MISRA-C Directive** (looser, intent-only) | ~5 |
| **PLC-domain — no MISRA-C equivalent** | ~45 |

If you're using plc-st-review on a project that also runs C code through a MISRA-C linter, this table is the bridge: the same intent shows up under both standards in their respective languages.
