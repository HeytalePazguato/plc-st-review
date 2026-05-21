# What each check can and can't catch

`plc-st-review` is a *static* reviewer, it works from the syntax tree, not from running code. That means every check has things it can see and things it can't. This page is the honest accounting.

The single biggest limitation across the whole tool: **there is no flow analysis**. Nothing knows what value a variable holds at runtime. So anywhere the check needs "the value of `i`" or "is this branch reachable", the answer is approximated from literals and resolvable constants only.

## Diff-based checks (compare before vs after)

These fire when something changes between revisions.

| Check | Catches | Doesn't catch |
|---|---|---|
| `SIGNATURE_CHANGED` | POU input / output / in-out renamed, removed, type-changed; new inputs without defaults | Argument order changes when names stay the same (we go by name) |
| `CALL_SITE_OUTDATED` | Callers missing newly-required inputs; unknown named arguments; FB-instance calls (`fbConveyor(...)` resolves through `fbConveyor : FB_Conveyor`) | Positional-arg calls beyond the simplest shape; calls through `super` or pointers |
| `TYPE_MISMATCH` | `VAR_GLOBAL` type changes | Type changes on local vars, parameters, struct fields (covered indirectly by `SIGNATURE_CHANGED` for params) |
| `ENUM_VALUE_REMOVED` | A CASE references a value that was removed from the enum | Comparisons (`if x = E.GONE`), only CASE values are walked |
| `ENUM_VALUE_ADDED` | Enum gains a value, CASE on that enum doesn't handle it and has no ELSE | CASEs whose switch expression doesn't surface the enum name |
| `TIMER_VALUE_CHANGED` | `TON`/`TOF`/`TP` PT changes (via named arg or explicit `.PT :=`) | Other timer parameters; PT changes computed at runtime |
| `CONSTANT_VALUE_CHANGED` | `VAR_GLOBAL CONSTANT` initial value changes | Constants declared inside POUs (no `VAR_GLOBAL`) |
| `COMMENT_ONLY` | File's AST is structurally identical between revisions | Adding/removing a no-op statement that compiles away |
| `ARRAY_BOUNDS_CHANGED` | A `VAR : ARRAY [a..b]` whose `a` or `b` changed | Multi-dim arrays where only one dimension changes (we report on the first range only) |
| `STATE_UNHANDLED` | Any CASE on an enum that doesn't cover every value and has no ELSE | Same blind-spots as `ENUM_VALUE_ADDED` |
| `UNREACHABLE_CODE` | Statement immediately after RETURN / EXIT / CONTINUE that's newly added | Code that's unreachable due to a constant-`FALSE` branch or impossible value comparison |
| `LOOP_BOUNDS_CHANGED` | FOR-loop start / end / step changed; severity scales with the iteration-count ratio | Loops where bounds depend on local vars |
| `POU_DELETED` | A FB / function / program disappears; callers still referencing it | Calls through pointer / interface refs whose target is the deleted POU |
| `POU_RENAMED` | Heuristic, a delete + add with identical input / output / in-out signatures, in the same review | Renames that also tweaked the signature |
| `METHOD_ADDED_TO_INTERFACE` | Interface gains a method, an FB that `IMPLEMENTS` it doesn't declare one | Inherited methods via `EXTENDS` (we walk only direct `methods` per POU) |
| `INHERITANCE_CHANGED` | `EXTENDS` clause added / removed / changed | New method on the base that the derived FB now silently inherits |
| `PRAGMA_CHANGED` | The set of pragmas in a file is different between revisions | Semantic effect of the pragma (we don't know what your codegen does with it) |
| `UNUSED_VAR_INTRODUCED` | New local declared in this PR, never referenced in its scope | Vars whose only use is via reflection / pragma-driven generated code |
| `COMPLEXITY_INCREASED` | A POU present in both revisions whose cyclomatic complexity rose | Complexity moved into a new helper POU (each piece looks fine); methods are scored as part of the enclosing FB, not separately |
| `NESTING_INCREASED` | A POU whose maximum control-structure nesting depth rose past the warn band | Refactors that keep the same max depth while adding many sibling branches; depth reduced in one branch but added in another at equal max |
| `LOC_SPIKE` | A POU present in both revisions whose LOC grew by more than 50% | Brand-new POUs (no prior revision to compare); growth spread thinly across many POUs |

## Static checks (look at the new revision in isolation)

These fire on bugs that exist in the new code, regardless of whether the PR introduced them. By default they only flag bugs that **weren't already present** in the old revision, adopting the tool on a legacy repo shouldn't dump a wall of pre-existing findings on day one. Toggle that filter via `severity_overrides` or `disabled_checks` if you want all hits.

| Check | Catches | Doesn't catch |
|---|---|---|
| `ENUM_VALUE_UNUSED` | Enum value declared but never referenced anywhere, dead state | Values referenced only through reflection / generated code |
| `ENUM_MEMBER_UNKNOWN` | `E_State.IDEL` typo when the enum's actual member is `IDLE` | Typos in non-enum member-access (e.g. struct fields), comparisons against integer literals, dynamic strings |
| `ARRAY_INDEX_OUT_OF_BOUNDS` | `arr[15]` when the array's bounds are `[0..9]` | Variable indices (`arr[i]`), indices computed by expression, accesses through a pointer to the array |
| `DIVISION_BY_ZERO` | `x / 0` literal, or `x / cZero` when `cZero` is a `VAR_GLOBAL CONSTANT` resolving to 0 | Divisors computed at runtime, `x / (a - b)` where `a` and `b` happen to be equal |
| `INFINITE_LOOP` | `WHILE TRUE DO ... END_WHILE;` with no `EXIT` inside | `WHILE x DO ...` where `x` is never updated inside the body (would need def-use analysis) |
| `LOOP_BOUNDS_REVERSED` | `FOR i := 10 TO 5 BY 1` (positive step with start > end); `FOR i := 1 TO 10 BY -1` (negative step with start < end). Per spec the body never runs; on runtimes that wrap integer overflow it runs hundreds of times | Loops whose start, end, or step are non-constant expressions |
| `COUNTER_VALUE_CHANGED` | `CTU`/`CTD`/`CTUD` `PV` changed between revisions; severity by ratio | Counters whose PV is a runtime variable |
| `COUNTER_PV_ZERO` | `C1(PV := 0)` or `C1.PV := 0` or a CONSTANT-resolving-to-0 PV | PV computed at runtime |
| `TIMER_PT_ZERO` | `T1(PT := T#0s)` or CONSTANT-resolving-to-0 PT | PT computed at runtime |
| `TIMER_NOT_DRIVEN` | A timer instance whose `.Q` / `.ET` is read but no call sets `IN` | Timers driven through indirect / pointer / reference access |
| `EDGE_TRIG_REUSED` | `R_TRIG` / `F_TRIG` invoked with two or more different `CLK` expressions | CLK expressions that are syntactically different but semantically equivalent (`xA` vs `(xA)`) |
| `FB_INSTANCE_DOUBLE_CALL` | Same FB instance invoked more than once in the same POU scope | Multiple calls intentionally placed inside mutually-exclusive `CASE`/`IF` branches, we don't track control flow |
| `FB_INSTANCE_NEVER_CALLED` | FB instance whose outputs are read but no call site exists | Instances whose only use is via `EXTENDS`-inherited methods (we'd need full-inheritance walking) |
| `BISTABLE_DOMINANCE_MISMATCH` | `SR` named like a reset-dominant latch, or `RS` named like a set-dominant one. Heuristic, name-pattern based | Shops with non-conventional naming will see false positives. Disable if not useful |
| `EMPTY_STATEMENT` | Lone `;` | Empty statements inside synthesized macro / pragma expansions if you use them |
| `UNUSED_RETURN_VALUE` | Bare-statement call of a `FUNCTION` POU with a declared return type | Discarded returns from external library functions whose signatures we don't see, calls via pointer-to-function |
| `ARRAY_SINGLE_ELEMENT` | `ARRAY [n..n] OF T` where bounds are literals | Bounds expressed as named constants that happen to evaluate equal (we'd need constant resolution per dimension) |
| `VARIABLE_SHADOWING` | Local declaration with the same name as a `VAR_GLOBAL` | Shadowing across nested scopes, methods inside an FB hiding the FB's locals, we only check local-vs-global |
| `UNQUALIFIED_ENUM_CONSTANT` | Bare identifier reference uniquely matching one enum's member | Member names shared by multiple enums (ambiguous), members already accessed via `member_access_expression` |
| `IDENTIFIER_CASE_MISMATCH` | Reference uses different case than the declared identifier | Library-provided identifiers whose canonical case we don't see |
| `UNUSED_INPUT_VAR` | `VAR_INPUT` with no read reference in the POU's body | Inputs read indirectly via reflection / pragma-driven generated code |
| `INPUT_VAR_WRITTEN` | LHS of an assignment matches a `VAR_INPUT` declared in the enclosing POU | Writes through pointer-to-input (rare in IEC ST) |
| `BOOL_COMPARISON` | `binary_expression` with `=`/`<>` and a `BOOLEAN_LITERAL` operand | Boolean comparisons via custom infix functions, comparisons against variables that happen to hold `TRUE`/`FALSE` |
| `REAL_EQUALITY` | `=`/`<>` against a `REAL_LITERAL` | Comparisons of two non-literal REALs (`rA = rB`), likely also unsafe but we can't tell statically |
| `MULTIPLE_EXIT_POINTS` | More than one `RETURN` per POU | `EXIT` statements inside loops (those leave the loop, not the POU) |
| `ASSIGNMENT_IN_CONDITION` | `:=` directly inside `IF`/`WHILE`/`REPEAT` condition lines | Assignments deep inside a function-call argument that's then used in the condition |
| `COMMENTED_OUT_CODE` | Comment text matches an ST keyword or `:=` heuristic | Prose comments that happen to contain `IF` or `:=` in different contexts |
| `RECURSIVE_CALL` | Direct self-call by name | Mutual recursion (A → B → A), would need call-graph traversal |
| `FORBIDDEN_SYMBOL` | Identifier matches a configured pattern in `forbidden_symbols` | Symbols referenced only via dynamic-string-construction lookups |
| `ADDRESS_OF_CONSTANT` | `ADR(c)` where `c` is a `VAR_GLOBAL CONSTANT` | `ADR(localConstant)`: locals don't have CONSTANT-marked symbols in our table |
| `UNUSED_OUTPUT_VAR` | `VAR_OUTPUT` with no LHS-of-assignment match in the POU's body | Outputs written via pointer indirection |
| `OUTPUT_VAR_READ_INTERNALLY` | `VAR_OUTPUT` referenced in a non-assignment position in its own POU | Reads through pointer indirection |
| `NESTED_COMMENTS` | `(*` inside a `(* ... *)` block comment | `(*` inside a string literal (parser usually handles this; we trust it) |
| `NAMING_CONVENTION` | Declaration name violates configured prefix / suffix / pattern | Identifiers that don't match any declared dimension (we only know the kinds we model) |

## When a check has no opinion

A check that doesn't fire isn't necessarily a sign that the code is fine, just that nothing this check looks at is wrong. If you want broader coverage of a category, file an issue with a concrete example: it's easier to extend an existing check than to argue about what one means.
