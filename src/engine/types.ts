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
  | 'COMMENT_ONLY';

export const ALL_CATEGORIES: Category[] = [
  'SIGNATURE_CHANGED',
  'CALL_SITE_OUTDATED',
  'TYPE_MISMATCH',
  'ENUM_VALUE_REMOVED',
  'ENUM_VALUE_ADDED',
  'TIMER_VALUE_CHANGED',
  'CONSTANT_VALUE_CHANGED',
  'COMMENT_ONLY',
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

export interface ResolvedConfig {
  disabledChecks: Set<Category>;
  severityOverrides: Map<Category, Severity>;
  ignorePaths: string[];
  safetyCriticalPrefixes: string[];
  failOnSeverity: Severity;
  commentStyle: 'inline' | 'summary' | 'both';
}

export interface SymbolTable {
  pous: Map<string, Pou>;
  globals: Map<string, GlobalVar>;
  enums: Map<string, EnumDef>;
  timerInstances: TimerInstance[];
  callSites: CallSite[];
  caseStatements: CaseSite[];
  varReferences: VarReference[];
  timerPtAssignments: TimerPtAssignment[];
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
  line: number;
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

export interface CallSite {
  callee: string;
  file: string;
  line: number;
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
  context: 'read' | 'write' | 'unknown';
}

export interface ReviewContext {
  config: ResolvedConfig;
  pairs: FilePair[];
  before: SymbolTable;
  after: SymbolTable;
}

export interface Check {
  readonly category: Category;
  readonly defaultSeverity: Severity;
  run(ctx: ReviewContext): Finding[];
}
