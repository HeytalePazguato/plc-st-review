import { NODE } from '../../src/engine/grammar.js';
import type { AstFile, StNode } from '../../src/engine/types.js';

let lineCounter = 1;

function nextLine(): number {
  return lineCounter++;
}

export function resetLines(): void {
  lineCounter = 1;
}

interface NodeOpts {
  text?: string;
  line?: number;
  children?: StNode[];
}

function node(type: string, opts: NodeOpts = {}): MutableNode {
  const line = opts.line ?? nextLine();
  const text = opts.text ?? '';
  const children = opts.children ?? [];
  const n: MutableNode = {
    type,
    text,
    startPosition: { row: line - 1, column: 0 },
    endPosition: { row: line - 1, column: text.length },
    children,
  };
  return n;
}

interface MutableNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: StNode[];
}

export interface ParamSpec {
  name: string;
  type: string;
  initial?: string;
}

export function paramDecl(p: ParamSpec): StNode {
  const kids: StNode[] = [
    node(NODE.IDENTIFIER, { text: p.name }),
    node(NODE.ELEMENTARY_TYPE, { text: p.type }),
  ];
  if (p.initial !== undefined) {
    if (/^T#/i.test(p.initial) || /^TIME#/i.test(p.initial)) {
      kids.push(node(NODE.TIME_LITERAL, { text: p.initial }));
    } else if (/^(TRUE|FALSE)$/i.test(p.initial)) {
      kids.push(node(NODE.BOOLEAN_LITERAL, { text: p.initial }));
    } else if (/\./.test(p.initial)) {
      kids.push(node(NODE.REAL_LITERAL, { text: p.initial }));
    } else if (/^['"]/.test(p.initial)) {
      kids.push(node(NODE.STRING_LITERAL, { text: p.initial }));
    } else {
      kids.push(node(NODE.INTEGER_LITERAL, { text: p.initial }));
    }
  }
  return node(NODE.VARIABLE_DECLARATION, {
    text: `${p.name} : ${p.type}${p.initial !== undefined ? ' := ' + p.initial : ''};`,
    children: kids,
  });
}

export function varInput(...params: ParamSpec[]): StNode {
  return node(NODE.VAR_INPUT, {
    children: params.map(paramDecl),
    text: 'VAR_INPUT ... END_VAR',
  });
}

export function varOutput(...params: ParamSpec[]): StNode {
  return node(NODE.VAR_OUTPUT, {
    children: params.map(paramDecl),
    text: 'VAR_OUTPUT ... END_VAR',
  });
}

export function varInOut(...params: ParamSpec[]): StNode {
  return node(NODE.VAR_IN_OUT, {
    children: params.map(paramDecl),
    text: 'VAR_IN_OUT ... END_VAR',
  });
}

export interface VarBlockOpts {
  constant?: boolean;
  retain?: boolean;
}

export function localVars(opts: VarBlockOpts, ...decls: StNode[]): StNode {
  const qualifiers: string[] = [];
  if (opts.constant) qualifiers.push('CONSTANT');
  if (opts.retain) qualifiers.push('RETAIN');
  const header = `VAR${qualifiers.length ? ' ' + qualifiers.join(' ') : ''}`;
  const kids: StNode[] = [];
  if (qualifiers.length > 0) {
    kids.push(
      node(NODE.VAR_QUALIFIER_LIST, {
        text: qualifiers.join(' '),
        children: qualifiers.map((q) => node(NODE.VAR_QUALIFIER, { text: q })),
      }),
    );
  }
  kids.push(...decls);
  return node(NODE.VAR_BLOCK, { text: header, children: kids });
}

export interface FbOpts {
  extends?: string;
  implements?: string[];
  inputs?: ParamSpec[];
  outputs?: ParamSpec[];
  inOuts?: ParamSpec[];
  methods?: StNode[];
  locals?: StNode[];
  line?: number;
}

export function fbDecl(name: string, opts: FbOpts = {}): StNode {
  const headerParts = [`FUNCTION_BLOCK ${name}`];
  if (opts.extends) headerParts.push(`EXTENDS ${opts.extends}`);
  if (opts.implements && opts.implements.length)
    headerParts.push(`IMPLEMENTS ${opts.implements.join(', ')}`);
  const headerText = headerParts.join(' ');
  const kids: StNode[] = [node(NODE.IDENTIFIER, { text: name })];
  if (opts.inputs && opts.inputs.length) kids.push(varInput(...opts.inputs));
  if (opts.outputs && opts.outputs.length) kids.push(varOutput(...opts.outputs));
  if (opts.inOuts && opts.inOuts.length) kids.push(varInOut(...opts.inOuts));
  if (opts.locals) kids.push(...opts.locals);
  if (opts.methods) kids.push(...opts.methods);
  return node(NODE.FUNCTION_BLOCK, {
    text: `${headerText}\n... END_FUNCTION_BLOCK`,
    children: kids,
    line: opts.line,
  });
}

export interface MethodOpts {
  inputs?: ParamSpec[];
  outputs?: ParamSpec[];
  inOuts?: ParamSpec[];
  line?: number;
}

export function methodDecl(name: string, opts: MethodOpts = {}): StNode {
  const kids: StNode[] = [node(NODE.IDENTIFIER, { text: name })];
  if (opts.inputs && opts.inputs.length) kids.push(varInput(...opts.inputs));
  if (opts.outputs && opts.outputs.length) kids.push(varOutput(...opts.outputs));
  if (opts.inOuts && opts.inOuts.length) kids.push(varInOut(...opts.inOuts));
  return node(NODE.METHOD, {
    text: `METHOD ${name} ... END_METHOD`,
    children: kids,
    line: opts.line,
  });
}

export function fnDecl(
  name: string,
  ret: string,
  opts: FbOpts = {},
): StNode {
  const kids: StNode[] = [
    node(NODE.IDENTIFIER, { text: name }),
    node(NODE.ELEMENTARY_TYPE, { text: ret }),
  ];
  if (opts.inputs && opts.inputs.length) kids.push(varInput(...opts.inputs));
  if (opts.outputs && opts.outputs.length) kids.push(varOutput(...opts.outputs));
  if (opts.inOuts && opts.inOuts.length) kids.push(varInOut(...opts.inOuts));
  return node(NODE.FUNCTION, {
    text: `FUNCTION ${name} : ${ret} ... END_FUNCTION`,
    children: kids,
  });
}

export function programDecl(
  name: string,
  body: StNode[] = [],
  locals: StNode[] = [],
): StNode {
  return node(NODE.PROGRAM, {
    text: `PROGRAM ${name} ... END_PROGRAM`,
    children: [node(NODE.IDENTIFIER, { text: name }), ...locals, ...body],
  });
}

export interface GlobalSpec {
  name: string;
  type: string;
  initial?: string;
  constant?: boolean;
}

export function globalsBlock(globals: GlobalSpec[]): StNode {
  const constant = globals.every((g) => g.constant);
  const inner = node(NODE.VAR_GLOBAL, {
    text: `VAR_GLOBAL${constant ? ' CONSTANT' : ''}`,
    children: globals.map((g) => paramDecl({
      name: g.name,
      type: g.type,
      initial: g.initial,
    })),
  });
  const header = `VAR_GLOBAL${constant ? ' CONSTANT' : ''}`;
  return node(NODE.GLOBAL_VAR_BLOCK, {
    text: header,
    children: [inner],
  });
}

export interface EnumValueSpec {
  name: string;
  value?: string;
}

export function enumTypeDecl(name: string, values: EnumValueSpec[]): StNode {
  const inline = node(NODE.ENUM_TYPE_INLINE, {
    text: `(${values.map((v) => v.name).join(', ')})`,
    children: values.map((v) =>
      node(NODE.ENUMERATOR, {
        text: v.value ? `${v.name} := ${v.value}` : v.name,
        children: [
          node(NODE.IDENTIFIER, { text: v.name }),
          ...(v.value ? [node(NODE.INTEGER_LITERAL, { text: v.value })] : []),
        ],
      }),
    ),
  });
  const def = node(NODE.TYPE_DEFINITION, {
    children: [inline],
    text: inline.text,
  });
  return node(NODE.TYPE_DECLARATION, {
    text: `TYPE ${name} : ${inline.text}; END_TYPE`,
    children: [node(NODE.IDENTIFIER, { text: name }), def],
  });
}

export function namedArg(name: string, valueText: string): StNode {
  const valueChild = inferLiteralNode(valueText);
  return node(NODE.NAMED_ARGUMENT, {
    text: `${name} := ${valueText}`,
    children: [
      node(NODE.IDENTIFIER, { text: name }),
      valueChild ?? node(NODE.IDENTIFIER, { text: valueText }),
    ],
  });
}

function inferLiteralNode(value: string): StNode | null {
  if (/^T#|^TIME#/i.test(value)) return node(NODE.TIME_LITERAL, { text: value });
  if (/^-?\d+$/.test(value)) return node(NODE.INTEGER_LITERAL, { text: value });
  if (/^-?\d+\.\d+$/.test(value)) return node(NODE.REAL_LITERAL, { text: value });
  if (/^(TRUE|FALSE)$/i.test(value)) return node(NODE.BOOLEAN_LITERAL, { text: value });
  if (/^['"]/.test(value)) return node(NODE.STRING_LITERAL, { text: value });
  return null;
}

export function invocation(
  callee: string,
  namedArgs: Record<string, string> = {},
  line?: number,
): StNode {
  const argList = node(NODE.ARGUMENT_LIST, {
    text: '(' + Object.entries(namedArgs)
      .map(([k, v]) => `${k} := ${v}`)
      .join(', ') + ')',
    children: Object.entries(namedArgs).map(([k, v]) => namedArg(k, v)),
  });
  return node(NODE.INVOCATION_STATEMENT, {
    text: `${callee}${argList.text};`,
    children: [
      node(NODE.IDENTIFIER, { text: callee }),
      argList,
    ],
    line,
  });
}

export function ptAssignment(
  timerName: string,
  value: string,
  line?: number,
): StNode {
  const lhs = node(NODE.MEMBER_ACCESS, {
    text: `${timerName}.PT`,
    children: [
      node(NODE.IDENTIFIER, { text: timerName }),
      node(NODE.IDENTIFIER, { text: 'PT' }),
    ],
  });
  const rhs = node(NODE.TIME_LITERAL, { text: value });
  return node(NODE.ASSIGNMENT_STATEMENT, {
    text: `${timerName}.PT := ${value};`,
    children: [lhs, rhs],
    line,
  });
}

export interface CaseSpec {
  switchExpr: string;
  values: string[];
  hasElse?: boolean;
}

export function caseStatement(spec: CaseSpec, line?: number): StNode {
  const switchNode = node(NODE.IDENTIFIER, { text: spec.switchExpr });
  const clauses: StNode[] = spec.values.map((v) =>
    node(NODE.CASE_CLAUSE, {
      text: `${v}:`,
      children: [
        node(NODE.CASE_VALUE, {
          text: v,
          children: [node(NODE.IDENTIFIER, { text: v })],
        }),
      ],
    }),
  );
  const kids: StNode[] = [switchNode, ...clauses];
  if (spec.hasElse) {
    kids.push(node(NODE.ELSE_CLAUSE, { text: 'ELSE ;' }));
  }
  return node(NODE.CASE_STATEMENT, {
    text: `CASE ${spec.switchExpr} OF ... END_CASE;`,
    children: kids,
    line,
  });
}

export function sourceFile(
  path: string,
  decls: StNode[],
  source?: string,
): AstFile {
  const root = node(NODE.SOURCE_FILE, {
    children: decls,
    text: source ?? decls.map((d) => d.text).join('\n'),
  });
  return {
    path,
    source: source ?? root.text,
    root,
  };
}
