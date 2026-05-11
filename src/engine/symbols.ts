import {
  NODE,
  POU_NODES,
  TIMER_TYPE_NAMES,
  childrenOf,
  descendantsOfAnyType,
  descendantsOfType,
  findChild,
  findChildren,
  findIdentifierText,
  lineOf,
  VAR_SECTION_NODES,
} from './grammar.js';
import type {
  AstFile,
  CallSite,
  EnumDef,
  GlobalVar,
  Parameter,
  Pou,
  PouKind,
  StNode,
  SymbolTable,
  TimerInstance,
  VarReference,
} from './types.js';

const POU_KIND_BY_NODE: Record<string, PouKind> = {
  [NODE.PROGRAM]: 'program',
  [NODE.FUNCTION]: 'function',
  [NODE.FUNCTION_BLOCK]: 'function_block',
  [NODE.METHOD]: 'method',
  [NODE.INTERFACE]: 'interface',
};

export function emptySymbolTable(): SymbolTable {
  return {
    pous: new Map(),
    globals: new Map(),
    enums: new Map(),
    timerInstances: [],
    callSites: [],
    caseStatements: [],
    varReferences: [],
    timerPtAssignments: [],
  };
}

export function buildSymbolTable(files: AstFile[]): SymbolTable {
  const t = emptySymbolTable();
  for (const file of files) extractFile(file, t);
  return t;
}

function extractFile(file: AstFile, t: SymbolTable): void {
  const root = file.root;
  for (const decl of childrenOf(root)) {
    if (decl.type === NODE.GLOBAL_VAR_BLOCK) {
      collectGlobals(file, decl, t);
    } else if (decl.type === NODE.TYPE_DECLARATION) {
      collectTypeDecl(file, decl, t);
    } else if (POU_NODES.has(decl.type)) {
      collectPou(file, decl, t, undefined);
    } else if (decl.type === NODE.NAMESPACE) {
      collectNamespace(file, decl, t);
    }
  }
  collectCallSites(file, t);
  collectCaseStatements(file, t);
  collectTimerPtAssignments(file, t);
  collectVarReferences(file, t);
}

function collectNamespace(file: AstFile, ns: StNode, t: SymbolTable): void {
  const nsName = findIdentifierText(ns) ?? '<anon>';
  for (const decl of childrenOf(ns)) {
    if (POU_NODES.has(decl.type)) {
      collectPou(file, decl, t, nsName);
    } else if (decl.type === NODE.TYPE_DECLARATION) {
      collectTypeDecl(file, decl, t, nsName);
    } else if (decl.type === NODE.GLOBAL_VAR_BLOCK) {
      collectGlobals(file, decl, t);
    }
  }
}

function collectPou(
  file: AstFile,
  node: StNode,
  t: SymbolTable,
  namespace: string | undefined,
): void {
  const kind = POU_KIND_BY_NODE[node.type];
  if (!kind) return;
  const name = findIdentifierText(node);
  if (!name) return;

  const qualified = namespace ? `${namespace}.${name}` : name;
  const inputs: Parameter[] = [];
  const outputs: Parameter[] = [];
  const inOuts: Parameter[] = [];
  let returnType: string | undefined;
  let extendsName: string | undefined;
  const implementsNames: string[] = [];

  for (const child of childrenOf(node)) {
    if (child.type === NODE.VAR_INPUT) {
      for (const p of extractParameters(child, 'input')) inputs.push(p);
    } else if (child.type === NODE.VAR_OUTPUT) {
      for (const p of extractParameters(child, 'output')) outputs.push(p);
    } else if (child.type === NODE.VAR_IN_OUT) {
      for (const p of extractParameters(child, 'in_out')) inOuts.push(p);
    } else if (child.type === NODE.ELEMENTARY_TYPE && kind === 'function') {
      // function return type appears as elementary_type or similar at top level
      returnType = child.text;
    }
  }

  // EXTENDS / IMPLEMENTS detection: look at top-level keyword-bearing children.
  const headerText = node.text.split('\n')[0] ?? '';
  const extMatch = /EXTENDS\s+([A-Za-z_][A-Za-z0-9_.]*)/i.exec(headerText);
  if (extMatch) extendsName = extMatch[1];
  const implMatch = /IMPLEMENTS\s+([A-Za-z0-9_.,\s]+)/i.exec(headerText);
  if (implMatch) {
    for (const raw of implMatch[1].split(',')) {
      const trimmed = raw.trim();
      if (trimmed) implementsNames.push(trimmed);
    }
  }
  // function return type can appear after a colon in header
  if (!returnType && kind === 'function') {
    const fnMatch = /FUNCTION\s+[A-Za-z_][A-Za-z0-9_]*\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/i.exec(
      headerText,
    );
    if (fnMatch) returnType = fnMatch[1];
  }

  const pou: Pou = {
    kind,
    name,
    qualifiedName: qualified,
    file: file.path,
    line: lineOf(node),
    inputs,
    outputs,
    inOuts,
    returnType,
    extends: extendsName,
    implements: implementsNames,
  };
  t.pous.set(qualified, pou);

  // Methods inside FBs/interfaces.
  for (const child of childrenOf(node)) {
    if (child.type === NODE.METHOD || child.type === NODE.METHOD_SIGNATURE) {
      const methodName = findIdentifierText(child);
      if (!methodName) continue;
      const methodQualified = `${qualified}.${methodName}`;
      const methodInputs: Parameter[] = [];
      const methodOutputs: Parameter[] = [];
      const methodInOuts: Parameter[] = [];
      for (const sub of childrenOf(child)) {
        if (sub.type === NODE.VAR_INPUT)
          methodInputs.push(...extractParameters(sub, 'input'));
        else if (sub.type === NODE.VAR_OUTPUT)
          methodOutputs.push(...extractParameters(sub, 'output'));
        else if (sub.type === NODE.VAR_IN_OUT)
          methodInOuts.push(...extractParameters(sub, 'in_out'));
      }
      const methodPou: Pou = {
        kind: 'method',
        name: methodName,
        qualifiedName: methodQualified,
        parent: qualified,
        file: file.path,
        line: lineOf(child),
        inputs: methodInputs,
        outputs: methodOutputs,
        inOuts: methodInOuts,
        implements: [],
      };
      t.pous.set(methodQualified, methodPou);
    }
  }

  // Timer instances inside this POU.
  for (const varBlock of descendantsOfAnyType(node, VAR_SECTION_NODES)) {
    for (const decl of findChildren(varBlock, NODE.VARIABLE_DECLARATION)) {
      const declName = findIdentifierText(decl);
      const typeNode = pickTypeNode(decl);
      const typeText = typeNode?.text?.trim().toUpperCase() ?? '';
      if (declName && TIMER_TYPE_NAMES.has(typeText)) {
        const timer: TimerInstance = {
          name: declName,
          timerType: typeText as 'TON' | 'TOF' | 'TP',
          file: file.path,
          line: lineOf(decl),
          scope: qualified,
        };
        t.timerInstances.push(timer);
      }
    }
  }
}

function extractParameters(
  varBlock: StNode,
  direction: Parameter['direction'],
): Parameter[] {
  const out: Parameter[] = [];
  for (const decl of findChildren(varBlock, NODE.VARIABLE_DECLARATION)) {
    const name = findIdentifierText(decl);
    if (!name) continue;
    const typeNode = pickTypeNode(decl);
    const initial = pickInitial(decl);
    out.push({
      name,
      direction,
      typeText: (typeNode?.text ?? '').trim(),
      initial,
      line: lineOf(decl),
    });
  }
  return out;
}

function pickTypeNode(decl: StNode): StNode | null {
  // Prefer an explicit type-node child.
  for (const c of childrenOf(decl)) {
    if (
      c.type === NODE.ELEMENTARY_TYPE ||
      c.type === NODE.GENERIC_TYPE ||
      c.type === NODE.ARRAY_TYPE ||
      c.type === NODE.SUBRANGE_TYPE ||
      c.type === NODE.POINTER_TYPE ||
      c.type === NODE.REFERENCE_TYPE ||
      c.type === NODE.STRING_TYPE ||
      c.type === NODE.STRUCTURE_TYPE_INLINE ||
      c.type === NODE.ENUM_TYPE_INLINE ||
      c.type === NODE.QUALIFIED_IDENTIFIER
    ) {
      return c;
    }
  }
  // Fallback: user-defined types and system FBs (TON/TOF/TP) come through as a
  // bare identifier — typically the second identifier child of the declaration.
  const idents: StNode[] = [];
  for (const c of childrenOf(decl)) {
    if (c.type === NODE.IDENTIFIER) idents.push(c);
  }
  if (idents.length >= 2) return idents[idents.length - 1];
  return null;
}

function pickInitial(decl: StNode): string | undefined {
  // Initial value tends to follow a `:=` token among the children.
  // We surface it as the last literal-like child.
  const kids = childrenOf(decl);
  for (let i = kids.length - 1; i >= 0; i--) {
    const c = kids[i];
    if (
      c.type === NODE.INTEGER_LITERAL ||
      c.type === NODE.REAL_LITERAL ||
      c.type === NODE.BOOLEAN_LITERAL ||
      c.type === NODE.STRING_LITERAL ||
      c.type === NODE.TIME_LITERAL
    ) {
      return c.text;
    }
  }
  return undefined;
}

function isConstantBlock(block: StNode): boolean {
  const qList = findChild(block, NODE.VAR_QUALIFIER_LIST);
  if (qList) {
    if (/\bCONSTANT\b/i.test(qList.text)) return true;
  }
  // some grammars emit a single var_qualifier
  for (const q of findChildren(block, NODE.VAR_QUALIFIER)) {
    if (/\bCONSTANT\b/i.test(q.text)) return true;
  }
  // fallback: textual scan of the block opener
  const opener = block.text.split('\n')[0] ?? '';
  return /\bCONSTANT\b/i.test(opener);
}

function isRetainBlock(block: StNode): boolean {
  const opener = block.text.split('\n')[0] ?? '';
  return /\bRETAIN\b/i.test(opener) || /\bPERSISTENT\b/i.test(opener);
}

function collectGlobals(file: AstFile, block: StNode, t: SymbolTable): void {
  const constant = isConstantBlock(block);
  const retain = isRetainBlock(block);
  for (const inner of descendantsOfAnyType(
    block,
    new Set<string>([NODE.VAR_GLOBAL, NODE.VAR_BLOCK]),
  )) {
    for (const decl of findChildren(inner, NODE.VARIABLE_DECLARATION)) {
      const name = findIdentifierText(decl);
      if (!name) continue;
      const typeNode = pickTypeNode(decl);
      const initial = pickInitial(decl);
      const g: GlobalVar = {
        name,
        file: file.path,
        line: lineOf(decl),
        typeText: (typeNode?.text ?? '').trim(),
        initial,
        constant,
        retain,
      };
      t.globals.set(name, g);
    }
  }
}

function collectTypeDecl(
  file: AstFile,
  node: StNode,
  t: SymbolTable,
  _namespace?: string,
): void {
  const name = findIdentifierText(node);
  if (!name) return;
  const def = findChild(node, NODE.TYPE_DEFINITION) ?? node;
  const enumInline =
    findChild(def, NODE.ENUM_TYPE_INLINE) ??
    descendantsOfType(def, NODE.ENUM_TYPE_INLINE)[0];
  if (enumInline) {
    const values: EnumDef['values'] = [];
    for (const e of descendantsOfType(enumInline, NODE.ENUMERATOR)) {
      const eName = findIdentifierText(e) ?? e.text.split(':=')[0]?.trim();
      if (!eName) continue;
      values.push({ name: eName, line: lineOf(e), value: pickInitial(e) });
    }
    const enumDef: EnumDef = {
      name,
      file: file.path,
      line: lineOf(node),
      values,
    };
    t.enums.set(name, enumDef);
  }
}

function collectCallSites(file: AstFile, t: SymbolTable): void {
  const invocations = descendantsOfAnyType(
    file.root,
    new Set<string>([NODE.INVOCATION_STATEMENT, NODE.CALL_EXPRESSION]),
  );
  for (const inv of invocations) {
    const callee = pickCallee(inv);
    if (!callee) continue;
    const argList =
      findChild(inv, NODE.ARGUMENT_LIST) ??
      descendantsOfType(inv, NODE.ARGUMENT_LIST)[0];
    const namedArgs = new Map<string, string>();
    const positional: string[] = [];
    if (argList) {
      for (const child of childrenOf(argList)) {
        if (child.type === NODE.NAMED_ARGUMENT) {
          const argName = findIdentifierText(child);
          if (argName) {
            const valueText = child.text.replace(/^[^:=]*:=\s*/, '').trim();
            namedArgs.set(argName, valueText);
          }
        } else if (child.type === ',' || child.type === '(' || child.type === ')') {
          continue;
        } else if (child.text && child.type !== NODE.COMMENT) {
          positional.push(child.text);
        }
      }
    }
    const cs: CallSite = {
      callee,
      file: file.path,
      line: lineOf(inv),
      namedArgs,
      positionalArgs: positional,
      rawText: inv.text,
    };
    t.callSites.push(cs);
  }
}

function pickCallee(invocation: StNode): string | null {
  // The callee is typically the first identifier / member_access / qualified_identifier child.
  for (const c of childrenOf(invocation)) {
    if (
      c.type === NODE.IDENTIFIER ||
      c.type === NODE.QUALIFIED_IDENTIFIER ||
      c.type === NODE.MEMBER_ACCESS ||
      c.type === NODE.VAR_ACCESS
    ) {
      return c.text;
    }
  }
  return null;
}

function collectCaseStatements(file: AstFile, t: SymbolTable): void {
  for (const cs of descendantsOfType(file.root, NODE.CASE_STATEMENT)) {
    const switchExpr = pickSwitchExpr(cs);
    const clauses = findChildren(cs, NODE.CASE_CLAUSE);
    const values: string[] = [];
    for (const clause of clauses) {
      for (const v of descendantsOfType(clause, NODE.CASE_VALUE)) {
        values.push(v.text.trim());
      }
    }
    const hasElse = !!findChild(cs, NODE.ELSE_CLAUSE);
    t.caseStatements.push({
      switchExpr: switchExpr ?? '',
      enumName: pickEnumNameFromSwitch(switchExpr),
      file: file.path,
      line: lineOf(cs),
      values,
      hasElse,
    });
  }
}

function pickSwitchExpr(cs: StNode): string | null {
  for (const c of childrenOf(cs)) {
    if (
      c.type === NODE.IDENTIFIER ||
      c.type === NODE.QUALIFIED_IDENTIFIER ||
      c.type === NODE.MEMBER_ACCESS ||
      c.type === NODE.BINARY_EXPRESSION ||
      c.type === NODE.UNARY_EXPRESSION ||
      c.type === NODE.VAR_ACCESS
    ) {
      return c.text;
    }
  }
  return null;
}

function pickEnumNameFromSwitch(expr: string | null | undefined): string | undefined {
  if (!expr) return undefined;
  // Heuristic: if the switch expr is bare ID and matches a known enum, the
  // caller checks the global enum table. Here we just hand back the trimmed text.
  return expr.trim().split(/[\s.]/).pop();
}

function collectTimerPtAssignments(file: AstFile, t: SymbolTable): void {
  // Pattern 1: explicit assignment `T1.PT := T#5s;`
  for (const asn of descendantsOfType(file.root, NODE.ASSIGNMENT_STATEMENT)) {
    const lhs = childrenOf(asn).find(
      (c) => c.type === NODE.MEMBER_ACCESS || c.type === NODE.QUALIFIED_IDENTIFIER,
    );
    if (!lhs) continue;
    const text = lhs.text;
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\.PT$/i.exec(text.trim());
    if (!m) continue;
    const timerName = m[1];
    const rhs = childrenOf(asn).find(
      (c) =>
        c.type === NODE.TIME_LITERAL ||
        c.type === NODE.INTEGER_LITERAL ||
        c.type === NODE.REAL_LITERAL,
    );
    if (!rhs) continue;
    t.timerPtAssignments.push({
      timerName,
      ptValue: rhs.text,
      file: file.path,
      line: lineOf(asn),
    });
  }

  // Pattern 2: named-arg call `T1(IN := xStart, PT := T#5s);`
  for (const cs of t.callSites.filter((c) => c.file === file.path)) {
    const pt = cs.namedArgs.get('PT');
    if (pt) {
      t.timerPtAssignments.push({
        timerName: cs.callee,
        ptValue: pt,
        file: file.path,
        line: cs.line,
      });
    }
  }
}

function collectVarReferences(file: AstFile, t: SymbolTable): void {
  for (const ref of descendantsOfType(file.root, NODE.IDENTIFIER)) {
    const refText = ref.text;
    if (!refText) continue;
    const v: VarReference = {
      name: refText,
      file: file.path,
      line: lineOf(ref),
      context: 'unknown',
    };
    t.varReferences.push(v);
  }
}
