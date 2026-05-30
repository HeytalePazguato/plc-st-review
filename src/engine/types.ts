export type Severity = 'info' | 'warn' | 'error';

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  warn: 1,
  error: 2,
};

export type Category =
  | 'SIGNATURE_CHANGED'
  | 'CALL_SITE_OUTDATED'
  | 'TYPE_MISMATCH'
  | 'ENUM_VALUE_REMOVED'
  | 'ENUM_VALUE_ADDED'
  | 'TIMER_VALUE_CHANGED'
  | 'CONSTANT_VALUE_CHANGED'
  | 'COMMENT_ONLY'
  | 'ARRAY_BOUNDS_CHANGED'
  | 'STATE_UNHANDLED'
  | 'UNREACHABLE_CODE'
  | 'LOOP_BOUNDS_CHANGED'
  | 'POU_DELETED'
  | 'POU_RENAMED'
  | 'METHOD_ADDED_TO_INTERFACE'
  | 'INHERITANCE_CHANGED'
  | 'PRAGMA_CHANGED'
  | 'UNUSED_VAR_INTRODUCED'
  | 'ENUM_VALUE_UNUSED'
  | 'ENUM_MEMBER_UNKNOWN'
  | 'ARRAY_INDEX_OUT_OF_BOUNDS'
  | 'DIVISION_BY_ZERO'
  | 'INFINITE_LOOP'
  | 'LOOP_BOUNDS_REVERSED'
  | 'COUNTER_VALUE_CHANGED'
  | 'COUNTER_PV_ZERO'
  | 'TIMER_PT_ZERO'
  | 'TIMER_NOT_DRIVEN'
  | 'EDGE_TRIG_REUSED'
  | 'FB_INSTANCE_DOUBLE_CALL'
  | 'FB_INSTANCE_NEVER_CALLED'
  | 'BISTABLE_DOMINANCE_MISMATCH'
  | 'EMPTY_STATEMENT'
  | 'UNUSED_RETURN_VALUE'
  | 'ARRAY_SINGLE_ELEMENT'
  | 'VARIABLE_SHADOWING'
  | 'UNQUALIFIED_ENUM_CONSTANT'
  | 'IDENTIFIER_CASE_MISMATCH'
  | 'UNUSED_INPUT_VAR'
  | 'INPUT_VAR_WRITTEN'
  | 'BOOL_COMPARISON'
  | 'REAL_EQUALITY'
  | 'MULTIPLE_EXIT_POINTS'
  | 'ASSIGNMENT_IN_CONDITION'
  | 'COMMENTED_OUT_CODE'
  | 'RECURSIVE_CALL'
  | 'FORBIDDEN_SYMBOL'
  | 'ADDRESS_OF_CONSTANT'
  | 'UNUSED_OUTPUT_VAR'
  | 'OUTPUT_VAR_READ_INTERNALLY'
  | 'NESTED_COMMENTS'
  | 'NAMING_CONVENTION'
  | 'COMPLEXITY_INCREASED'
  | 'NESTING_INCREASED'
  | 'LOC_SPIKE'
  | 'DEAD_POU_INTRODUCED';

/**
 * Categories that only make sense when comparing two revisions of the
 * code: their definition is "what changed between before and after?".
 * In `--lint` mode (no base ref, just a static analysis of the current
 * tree) these are auto-disabled, running them would either silently
 * produce zero findings or, in two cases (PRAGMA_CHANGED and
 * UNUSED_VAR_INTRODUCED), surface every pragma / every variable as a
 * "new" finding.
 */
export const DIFF_ONLY_CATEGORIES: ReadonlySet<Category> = new Set<Category>([
  'SIGNATURE_CHANGED',
  'TYPE_MISMATCH',
  'ENUM_VALUE_REMOVED',
  'ENUM_VALUE_ADDED',
  'TIMER_VALUE_CHANGED',
  'CONSTANT_VALUE_CHANGED',
  'COMMENT_ONLY',
  'ARRAY_BOUNDS_CHANGED',
  'LOOP_BOUNDS_CHANGED',
  'POU_DELETED',
  'POU_RENAMED',
  'METHOD_ADDED_TO_INTERFACE',
  'INHERITANCE_CHANGED',
  'PRAGMA_CHANGED',
  'COUNTER_VALUE_CHANGED',
  'UNUSED_VAR_INTRODUCED',
  'ENUM_VALUE_UNUSED',
  // Metric-regression checks compare a POU's metrics between revisions, so
  // they need a `before` to diff against and are auto-disabled in --lint mode.
  'COMPLEXITY_INCREASED',
  'NESTING_INCREASED',
  'LOC_SPIKE',
  'DEAD_POU_INTRODUCED',
]);

export const ALL_CATEGORIES: Category[] = [
  'SIGNATURE_CHANGED',
  'CALL_SITE_OUTDATED',
  'TYPE_MISMATCH',
  'ENUM_VALUE_REMOVED',
  'ENUM_VALUE_ADDED',
  'TIMER_VALUE_CHANGED',
  'CONSTANT_VALUE_CHANGED',
  'COMMENT_ONLY',
  'ARRAY_BOUNDS_CHANGED',
  'STATE_UNHANDLED',
  'UNREACHABLE_CODE',
  'LOOP_BOUNDS_CHANGED',
  'POU_DELETED',
  'POU_RENAMED',
  'METHOD_ADDED_TO_INTERFACE',
  'INHERITANCE_CHANGED',
  'PRAGMA_CHANGED',
  'UNUSED_VAR_INTRODUCED',
  'ENUM_VALUE_UNUSED',
  'ENUM_MEMBER_UNKNOWN',
  'ARRAY_INDEX_OUT_OF_BOUNDS',
  'DIVISION_BY_ZERO',
  'INFINITE_LOOP',
  'LOOP_BOUNDS_REVERSED',
  'COUNTER_VALUE_CHANGED',
  'COUNTER_PV_ZERO',
  'TIMER_PT_ZERO',
  'TIMER_NOT_DRIVEN',
  'EDGE_TRIG_REUSED',
  'FB_INSTANCE_DOUBLE_CALL',
  'FB_INSTANCE_NEVER_CALLED',
  'BISTABLE_DOMINANCE_MISMATCH',
  'EMPTY_STATEMENT',
  'UNUSED_RETURN_VALUE',
  'ARRAY_SINGLE_ELEMENT',
  'VARIABLE_SHADOWING',
  'UNQUALIFIED_ENUM_CONSTANT',
  'IDENTIFIER_CASE_MISMATCH',
  'UNUSED_INPUT_VAR',
  'INPUT_VAR_WRITTEN',
  'BOOL_COMPARISON',
  'REAL_EQUALITY',
  'MULTIPLE_EXIT_POINTS',
  'ASSIGNMENT_IN_CONDITION',
  'COMMENTED_OUT_CODE',
  'RECURSIVE_CALL',
  'FORBIDDEN_SYMBOL',
  'ADDRESS_OF_CONSTANT',
  'UNUSED_OUTPUT_VAR',
  'OUTPUT_VAR_READ_INTERNALLY',
  'NESTED_COMMENTS',
  'NAMING_CONVENTION',
  'COMPLEXITY_INCREASED',
  'NESTING_INCREASED',
  'LOC_SPIKE',
  'DEAD_POU_INTRODUCED',
];

export interface Position {
  row: number;
  column: number;
}

export interface StNode {
  readonly type: string;
  readonly text: string;
  readonly startPosition: Position;
  readonly endPosition: Position;
  readonly children: readonly StNode[];
  readonly namedChildren?: readonly StNode[];
  readonly parent?: StNode | null;
  readonly previousSibling?: StNode | null;
  readonly previousNamedSibling?: StNode | null;
  readonly nextSibling?: StNode | null;
  readonly nextNamedSibling?: StNode | null;
  childForFieldName?(name: string): StNode | null;
}

export interface AstFile {
  path: string;
  source: string;
  root: StNode;
}

export interface FilePair {
  path: string;
  before: AstFile | null;
  after: AstFile | null;
}

export interface Finding {
  severity: Severity;
  category: Category;
  file: string;
  line: number;
  column?: number;
  summary: string;
  detail?: string;
  related?: Array<{ file: string; line: number; note?: string }>;
}

export interface NamingRule {
  prefix?: string;
  suffix?: string;
  pattern?: string;       // regex against the whole identifier
  case?: 'sensitive' | 'insensitive';
  severity?: Severity;
}

export type NamingDimension =
  | 'bool'
  | 'int'
  | 'real'
  | 'string'
  | 'time'
  | 'pointer'
  | 'reference'
  | 'array'
  | 'enum_type'
  | 'structure_type'
  | 'function_block'
  | 'function'
  | 'program'
  | 'method'
  | 'interface'
  | 'fb_instance'
  | 'global_var'
  | 'input_var'
  | 'output_var'
  | 'in_out_var'
  | 'constant';

/** A metric with a warn band and an error band (higher is worse). */
export interface RangeThreshold {
  warn: number;
  error: number;
}

/**
 * Thresholds for the metrics feature. Used by the metric-regression checks
 * (Phase 1) and, later, the standalone `--metrics` mode (Phase 2). `fanOut`
 * and `commentRatio` are carried here so the config surface is stable; only
 * `cyclomaticComplexity` and `nestingDepth` are consumed in Phase 1.
 */
export interface MetricsThresholds {
  cyclomaticComplexity: RangeThreshold;
  nestingDepth: RangeThreshold;
  linesOfCode: RangeThreshold;
  commentRatio: { warnBelow: number };
  fanOut: RangeThreshold;
}

export interface ResolvedConfig {
  disabledChecks: Set<Category>;
  severityOverrides: Map<Category, Severity>;
  ignorePaths: string[];
  safetyCriticalPrefixes: string[];
  failOnSeverity: Severity;
  commentStyle: 'inline' | 'summary' | 'both';
  forbiddenSymbols: string[];
  namingConventions: Partial<Record<NamingDimension, NamingRule>>;
  namingIgnore: string[];   // identifier patterns to skip for NAMING_CONVENTION
  metricsThresholds: MetricsThresholds;
  /**
   * Whether identifiers are compared case-sensitively. Dialect-dependent:
   * generic IEC 61131-3, Beckhoff/TwinCAT and CODESYS are case-insensitive
   * (the default, `false`); B&R Automation Studio is case-sensitive (`true`).
   * Drives the symbol-table identifier maps and gates IDENTIFIER_CASE_MISMATCH.
   */
  caseSensitive: boolean;
}

export interface SymbolTable {
  /**
   * Whether identifier keys in this table are case-sensitive. Mirrors the
   * resolved config; carried here so collectors that build per-call-site maps
   * (e.g. named arguments) pick the same mode as `globals` / `enums`.
   */
  caseSensitive: boolean;
  pous: Map<string, Pou>;
  globals: Map<string, GlobalVar>;
  enums: Map<string, EnumDef>;
  timerInstances: TimerInstance[];
  callSites: CallSite[];
  caseStatements: CaseSite[];
  varReferences: VarReference[];
  timerPtAssignments: TimerPtAssignment[];
  arrayDecls: ArrayDecl[];
  forLoops: ForLoop[];
  pragmas: Pragma[];
  unreachable: UnreachableStmt[];
  pouLocals: Map<string, LocalVar[]>; // by POU qualified name
  memberAccesses: MemberAccess[];
  whileLoops: WhileLoop[];
  arrayAccesses: ArrayAccess[];
  divisions: DivisionExpr[];
  counterInstances: CounterInstance[];
  counterPvAssignments: CounterPvAssignment[];
  edgeTrigInstances: EdgeTrigInstance[];
  bistableInstances: BistableInstance[];
  emptyStatements: EmptyStmt[];
  comments: CommentNode[];
  assignmentTargets: AssignmentTarget[];
  returnPoints: ReturnPoint[];
  declarations: NamedDecl[];
  addressOfExprs: AddressOfExpr[];
}

export interface AddressOfExpr {
  operand: string; // text of the addressed operand, e.g. `SAFETY_TIMEOUT`, `T1.PT`
  file: string;
  line: number;
  scope: string;
}

export type PouKind =
  | 'program'
  | 'function'
  | 'function_block'
  | 'method'
  | 'interface';

export interface Parameter {
  name: string;
  direction: 'input' | 'output' | 'in_out';
  typeText: string;
  initial?: string;
  line: number;
}

export interface Pou {
  kind: PouKind;
  name: string;
  qualifiedName: string;
  parent?: string;
  file: string;
  /** 1-based start line of the POU's declaration keyword (e.g. `FUNCTION_BLOCK`). */
  line: number;
  /** 1-based end line of the POU's `END_*` keyword. Used to attribute a source
   *  line to its enclosing scope. */
  endLine: number;
  inputs: Parameter[];
  outputs: Parameter[];
  inOuts: Parameter[];
  returnType?: string;
  extends?: string;
  implements: string[];
}

export interface GlobalVar {
  name: string;
  file: string;
  line: number;
  typeText: string;
  initial?: string;
  constant: boolean;
  retain: boolean;
}

export interface EnumDef {
  name: string;
  file: string;
  line: number;
  values: Array<{ name: string; line: number; value?: string }>;
}

export interface TimerInstance {
  name: string;
  timerType: 'TON' | 'TOF' | 'TP';
  file: string;
  line: number;
  scope: string;
}

export interface TimerPtAssignment {
  timerName: string;
  ptValue: string;
  file: string;
  line: number;
}

export interface CounterInstance {
  name: string;
  counterType: 'CTU' | 'CTD' | 'CTUD';
  file: string;
  line: number;
  scope: string;
}

export interface CounterPvAssignment {
  counterName: string;
  pvValue: string;
  file: string;
  line: number;
}

export interface EdgeTrigInstance {
  name: string;
  trigType: 'R_TRIG' | 'F_TRIG';
  file: string;
  line: number;
  scope: string;
}

export interface BistableInstance {
  name: string;
  bistableType: 'SR' | 'RS';
  file: string;
  line: number;
  scope: string;
}

export interface CallSite {
  callee: string;
  file: string;
  line: number;
  scope: string;
  namedArgs: Map<string, string>;
  positionalArgs: string[];
  rawText: string;
}

export interface CaseSite {
  switchExpr: string;
  enumName?: string;
  file: string;
  line: number;
  values: string[];
  hasElse: boolean;
}

export interface VarReference {
  name: string;
  file: string;
  line: number;
  scope: string;
  context: 'read' | 'write' | 'unknown';
}

export interface EmptyStmt {
  file: string;
  line: number;
  scope: string;
}

export interface CommentNode {
  text: string;
  file: string;
  line: number;
  scope: string;
}

export interface AssignmentTarget {
  name: string;          // bare identifier or first segment of member access
  rawText: string;       // the full LHS text (e.g. `T1.PT`, `arr[5]`)
  file: string;
  line: number;
  scope: string;
}

export interface ReturnPoint {
  file: string;
  line: number;
  scope: string;
}

export type DeclKind =
  | 'program'
  | 'function'
  | 'function_block'
  | 'method'
  | 'interface'
  | 'enum_type'
  | 'structure_type'
  | 'array_type'
  | 'alias_type'
  | 'var_local'
  | 'var_global'
  | 'var_input'
  | 'var_output'
  | 'var_in_out'
  | 'var_temp'
  | 'constant'
  | 'fb_instance'
  | 'timer_instance'
  | 'counter_instance'
  | 'edge_trig_instance'
  | 'bistable_instance';

export interface NamedDecl {
  name: string;
  kind: DeclKind;
  typeText?: string;       // for typed vars: the type name as text
  file: string;
  line: number;
  scope: string;
}

export interface ArrayDecl {
  varName: string;
  scope: string; // qualified POU name or '__global'
  file: string;
  line: number;
  lower: string;
  upper: string;
  elementType: string;
}

export interface ForLoop {
  scope: string;
  file: string;
  line: number;
  loopVar: string;
  start: string;
  end: string;
  by?: string;
}

export interface Pragma {
  file: string;
  line: number;
  text: string;
}

export interface UnreachableStmt {
  scope: string;
  file: string;
  line: number;
  reason: 'after_return' | 'after_exit' | 'after_continue';
}

export interface LocalVar {
  name: string;
  scope: string;
  file: string;
  line: number;
  typeText: string;
}

export interface MemberAccess {
  leftText: string;
  rightText: string;
  file: string;
  line: number;
  scope: string;
}

export interface WhileLoop {
  file: string;
  line: number;
  scope: string;
  conditionText: string;
  hasExit: boolean;
}

export interface ArrayAccess {
  arrayName: string;
  indexText: string;
  indexValue: number | null;
  file: string;
  line: number;
  scope: string;
}

export interface DivisionExpr {
  divisorText: string;
  file: string;
  line: number;
  scope: string;
}

export interface ReviewContext {
  config: ResolvedConfig;
  pairs: FilePair[];
  before: SymbolTable;
  after: SymbolTable;
  /**
   * Whole-repo symbol table at the head revision, present only when the run
   * was invoked with project scope. Checks with `scope: 'project'` need this;
   * it is undefined on a normal diff-only run.
   */
  project?: SymbolTable;
}

export interface Check {
  readonly category: Category;
  readonly defaultSeverity: Severity;
  /**
   * `'diff'` (default) checks run on the before/after pair. `'project'` checks
   * additionally need `ctx.project` (the whole-repo table) and are skipped when
   * it is absent.
   */
  readonly scope?: 'diff' | 'project';
  run(ctx: ReviewContext): Finding[];
}
