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
  ArrayDecl,
  AstFile,
  CallSite,
  EnumDef,
  ForLoop,
  GlobalVar,
  LocalVar,
  Parameter,
  Pou,
  PouKind,
  StNode,
  SymbolTable,
  TimerInstance,
  UnreachableStmt,
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
    arrayDecls: [],
    forLoops: [],
    pragmas: [],
    unreachable: [],
    pouLocals: new Map(),
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
    } else if (decl.type === NODE.PRAGMA) {
      t.pragmas.push({
        file: file.path,
        line: lineOf(decl),
        text: decl.text,
      });
    }
  }
  collectCallSites(file, t);
  collectCaseStatements(file, t);
  collectTimerPtAssignments(file, t);
  collectVarReferences(file, t);
  // pragmas inside POUs
  for (const p of descendantsOfType(root, NODE.PRAGMA)) {
    if (childrenOf(root).includes(p)) continue; // already collected at top level
    t.pragmas.push({
      file: file.path,
      line: lineOf(p),
      text: p.text,
    });
  }
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

  const locals: LocalVar[] = [];
  // Timer instances + array decls + locals catalogue for this POU.
  for (const varBlock of descendantsOfAnyType(node, VAR_SECTION_NODES)) {
    for (const decl of findChildren(varBlock, NODE.VARIABLE_DECLARATION)) {
      const declName = findIdentifierText(decl);
      const typeNode = pickTypeNode(decl);
      const typeText = typeNode?.text?.trim().toUpperCase() ?? '';
      if (declName) {
        locals.push({
          name: declName,
          scope: qualified,
          file: file.path,
          line: lineOf(decl),
          typeText: typeText,
        });
      }
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
      const arrType =
        typeNode?.type === NODE.ARRAY_TYPE ? typeNode : findChild(decl, NODE.ARRAY_TYPE);
      if (declName && arrType) {
        const sr = findChild(arrType, NODE.SUBRANGE);
        const elem = findChild(arrType, NODE.ELEMENTARY_TYPE);
        if (sr) {
          const ints = childrenOf(sr).filter(
            (c) => c.type === NODE.INTEGER_LITERAL || c.type === NODE.REAL_LITERAL,
          );
          if (ints.length >= 2) {
            const arr: ArrayDecl = {
              varName: declName,
              scope: qualified,
              file: file.path,
              line: lineOf(decl),
              lower: ints[0].text,
              upper: ints[1].text,
              elementType: (elem?.text ?? '').trim(),
            };
            t.arrayDecls.push(arr);
          }
        }
      }
    }
  }
  t.pouLocals.set(qualified, locals);

  collectForLoops(file, node, qualified, t);
  collectUnreachable(file, node, qualified, t);
}

function collectForLoops(
  file: AstFile,
  pouNode: StNode,
  scope: string,
  t: SymbolTable,
): void {
  const isBoundExpr = (n: StNode | undefined): boolean =>
    !!n &&
    (n.type === NODE.INTEGER_LITERAL ||
      n.type === NODE.REAL_LITERAL ||
      n.type === NODE.IDENTIFIER);
  for (const fs of descendantsOfType(pouNode, NODE.FOR_STATEMENT)) {
    // FOR <var> := <start> TO <end> [BY <by>] DO ... END_FOR
    // The first child is the loop variable identifier; bounds follow in order.
    const kids = childrenOf(fs);
    const loopVarNode = kids[0];
    const startNode = kids[1];
    const endNode = kids[2];
    const byNode = kids[3];
    if (!loopVarNode || loopVarNode.type !== NODE.IDENTIFIER) continue;
    if (!isBoundExpr(startNode) || !isBoundExpr(endNode)) continue;
    const loop: ForLoop = {
      scope,
      file: file.path,
      line: lineOf(fs),
      loopVar: loopVarNode.text,
      start: startNode.text,
      end: endNode.text,
      by: isBoundExpr(byNode) ? byNode.text : undefined,
    };
    t.forLoops.push(loop);
  }
}

const TERMINATOR_TYPES = new Set<string>([
  NODE.RETURN_STATEMENT,
  NODE.EXIT_STATEMENT,
  NODE.CONTINUE_STATEMENT,
]);

const STATEMENT_TYPES = new Set<string>([
  NODE.ASSIGNMENT_STATEMENT,
  NODE.INVOCATION_STATEMENT,
  NODE.IF_STATEMENT,
  NODE.CASE_STATEMENT,
  NODE.FOR_STATEMENT,
  NODE.WHILE_STATEMENT,
  NODE.REPEAT_STATEMENT,
  NODE.RETURN_STATEMENT,
  NODE.EXIT_STATEMENT,
  NODE.CONTINUE_STATEMENT,
]);

function collectUnreachable(
  file: AstFile,
  pouNode: StNode,
  scope: string,
  t: SymbolTable,
): void {
  // Walk every node that holds an ordered list of statements as direct children.
  const stack: StNode[] = [pouNode];
  while (stack.length) {
    const n = stack.pop()!;
    const kids = childrenOf(n);
    let terminator: StNode | null = null;
    for (const child of kids) {
      if (terminator && STATEMENT_TYPES.has(child.type)) {
        const reason =
          terminator.type === NODE.RETURN_STATEMENT
            ? 'after_return'
            : terminator.type === NODE.EXIT_STATEMENT
              ? 'after_exit'
              : 'after_continue';
        const u: UnreachableStmt = {
          scope,
          file: file.path,
          line: lineOf(child),
          reason,
        };
        t.unreachable.push(u);
        terminator = null; // only flag the immediate next statement
      }
      if (TERMINATOR_TYPES.has(child.type)) terminator = child;
      stack.push(child);
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
  // The grammar wraps the actual definition (incl. the identifier) inside a
  // `type_definition` child of `type_declaration`. Search there first.
  const def = findChild(node, NODE.TYPE_DEFINITION) ?? node;
  const name = findIdentifierText(def) ?? findIdentifierText(node);
  if (!name) return;
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
