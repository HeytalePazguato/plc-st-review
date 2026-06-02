import {
  NODE,
  POU_NODES,
  TIMER_TYPE_NAMES,
  allChildrenOf,
  childrenOf,
  descendantsOfAnyType,
  descendantsOfType,
  findChild,
  findChildren,
  findIdentifierText,
  lineOf,
  VAR_SECTION_NODES,
} from './grammar.js';
import { CaseMap } from './case-map.js';
import { parseStNumber } from './literals.js';
import type {
  ArrayAccess,
  ArrayDecl,
  AssignmentTarget,
  AstFile,
  BistableInstance,
  CallSite,
  CommentNode,
  CounterInstance,
  DivisionExpr,
  EdgeTrigInstance,
  EmptyStmt,
  EnumDef,
  ForLoop,
  GlobalVar,
  LocalVar,
  MemberAccess,
  NamedDecl,
  Parameter,
  Pou,
  PouKind,
  ReturnPoint,
  StNode,
  SymbolTable,
  TimerInstance,
  UnreachableStmt,
  VarReference,
  WhileLoop,
} from './types.js';

const COUNTER_TYPE_NAMES = new Set<string>(['CTU', 'CTD', 'CTUD']);
const EDGE_TRIG_TYPE_NAMES = new Set<string>(['R_TRIG', 'F_TRIG']);
const BISTABLE_TYPE_NAMES = new Set<string>(['SR', 'RS']);

// Var-block subset that holds true POU-local storage (vs. parameter passing
// or file-level globals). `pouLocals` is keyed off this so a parameter named
// `xCount` doesn't also surface as a local.
const LOCAL_STORAGE_SECTION_NODES = new Set<string>([
  NODE.VAR_BLOCK,
  NODE.VAR_TEMP,
  NODE.VAR_EXTERNAL,
]);

const POU_KIND_BY_NODE: Record<string, PouKind> = {
  [NODE.PROGRAM]: 'program',
  [NODE.FUNCTION]: 'function',
  [NODE.FUNCTION_BLOCK]: 'function_block',
  [NODE.METHOD]: 'method',
  [NODE.INTERFACE]: 'interface',
};

export function emptySymbolTable(caseSensitive = false): SymbolTable {
  return {
    caseSensitive,
    pous: new CaseMap(caseSensitive),
    globals: new CaseMap(caseSensitive),
    globalDecls: [],
    enums: new CaseMap(caseSensitive),
    directAddresses: [],
    ifStatements: [],
    restrictedStatements: [],
    pointerVars: [],
    binaryExpressions: [],
    timerInstances: [],
    callSites: [],
    caseStatements: [],
    varReferences: [],
    timerPtAssignments: [],
    arrayDecls: [],
    forLoops: [],
    pragmas: [],
    unreachable: [],
    pouLocals: new CaseMap(caseSensitive),
    memberAccesses: [],
    whileLoops: [],
    arrayAccesses: [],
    divisions: [],
    counterInstances: [],
    counterPvAssignments: [],
    edgeTrigInstances: [],
    bistableInstances: [],
    emptyStatements: [],
    comments: [],
    assignmentTargets: [],
    returnPoints: [],
    declarations: [],
    addressOfExprs: [],
  };
}

export function buildSymbolTable(files: AstFile[], caseSensitive = false): SymbolTable {
  const t = emptySymbolTable(caseSensitive);
  for (const file of files) extractFile(file, t);
  t.declarations = buildDeclarations(t);
  return t;
}

function buildDeclarations(t: SymbolTable): NamedDecl[] {
  const out: NamedDecl[] = [];
  // POUs themselves (program / function / function_block / method / interface).
  for (const p of t.pous.values()) {
    out.push({
      name: p.name,
      kind: p.kind,
      file: p.file,
      line: p.line,
      scope: p.parent ?? '__global',
    });
    // Parameters: inputs, outputs, in_outs.
    for (const inp of p.inputs) {
      out.push({
        name: inp.name,
        kind: 'var_input',
        typeText: inp.typeText,
        file: p.file,
        line: inp.line,
        scope: p.qualifiedName,
      });
    }
    for (const o of p.outputs) {
      out.push({
        name: o.name,
        kind: 'var_output',
        typeText: o.typeText,
        file: p.file,
        line: o.line,
        scope: p.qualifiedName,
      });
    }
    for (const io of p.inOuts) {
      out.push({
        name: io.name,
        kind: 'var_in_out',
        typeText: io.typeText,
        file: p.file,
        line: io.line,
        scope: p.qualifiedName,
      });
    }
  }
  // Locals (incl. timer/counter/edge-trig/bistable instances and FB instances).
  for (const [, locals] of t.pouLocals) {
    for (const l of locals) {
      out.push({
        name: l.name,
        kind: inferLocalKind(l, t),
        typeText: l.typeText,
        file: l.file,
        line: l.line,
        scope: l.scope,
      });
    }
  }
  // Globals (constants and non-constants). Iterate `globalDecls`, not
  // `globals.values()`, so a name declared in two files surfaces both sites —
  // NAME_REUSED_DIFFERENT_KIND can then spot the collision instead of being
  // blinded by the last-write-wins `globals` index.
  for (const g of t.globalDecls) {
    out.push({
      name: g.name,
      kind: g.constant ? 'constant' : 'var_global',
      typeText: g.typeText,
      file: g.file,
      line: g.line,
      scope: '__global',
    });
  }
  // Enum types.
  for (const e of t.enums.values()) {
    out.push({
      name: e.name,
      kind: 'enum_type',
      file: e.file,
      line: e.line,
      scope: '__global',
    });
  }
  return out;
}

function inferLocalKind(l: LocalVar, t: SymbolTable): NamedDecl['kind'] {
  // VAR_EXTERNAL gets its own kind so PLCopen CP6 can spot externals declared
  // inside FUNCTION / FUNCTION_BLOCK / METHOD bodies (PLCopen forbids it). VAR
  // and VAR_TEMP keep falling into `var_local` since CP6 doesn't apply to them.
  if (l.section === NODE.VAR_EXTERNAL) return 'var_external';
  const tt = l.typeText.trim().toUpperCase();
  if (TIMER_TYPE_NAMES.has(tt)) return 'timer_instance';
  if (COUNTER_TYPE_NAMES.has(tt)) return 'counter_instance';
  if (EDGE_TRIG_TYPE_NAMES.has(tt)) return 'edge_trig_instance';
  if (BISTABLE_TYPE_NAMES.has(tt)) return 'bistable_instance';
  const matched = t.pous.get(l.typeText.trim());
  if (matched && matched.kind === 'function_block') return 'fb_instance';
  return 'var_local';
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
  collectFileScopedStatements(file, t);
  collectAddressOfExprs(file, t);
  collectComments(file, t);
  collectDirectAddresses(file, t);
  collectIfStatements(file, t);
  collectRestrictedStatements(file, t);
  collectBinaryExpressions(file, t);
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
    endLine: node.endPosition.row + 1,
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
        endLine: child.endPosition.row + 1,
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
      // Push into `locals` only when the enclosing block is a *local-storage*
      // section. VAR_INPUT / VAR_OUTPUT / VAR_IN_OUT are parameters (already
      // collected into Pou.inputs / outputs / inOuts via extractParameters)
      // and VAR_GLOBAL is a file-level thing; without this filter every
      // parameter name was double-counted as a local, which spuriously fired
      // NAME_REUSED_DIFFERENT_KIND (the same name in `var_input` + `var_local`
      // kinds) and UNINITIALIZED_VAR_USED (every VAR_INPUT looked like an
      // uninitialised local). Timer / counter / edge-trig / bistable /
      // pointer / array detection below still walks every section so a TON
      // declared as a parameter, while unusual, doesn't go unindexed.
      if (declName && LOCAL_STORAGE_SECTION_NODES.has(varBlock.type)) {
        locals.push({
          name: declName,
          scope: qualified,
          file: file.path,
          line: lineOf(decl),
          typeText: typeText,
          section: varBlock.type,
          initial: pickInitial(decl),
        });
      }
      // POINTER-typed locals — used by POINTER_ARITHMETIC / POINTER_COMPARED.
      if (declName && typeNode?.type === NODE.POINTER_TYPE) {
        t.pointerVars.push({
          name: declName,
          scope: qualified,
          file: file.path,
          line: lineOf(decl),
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
      if (declName && COUNTER_TYPE_NAMES.has(typeText)) {
        const counter: CounterInstance = {
          name: declName,
          counterType: typeText as 'CTU' | 'CTD' | 'CTUD',
          file: file.path,
          line: lineOf(decl),
          scope: qualified,
        };
        t.counterInstances.push(counter);
      }
      if (declName && EDGE_TRIG_TYPE_NAMES.has(typeText)) {
        const edge: EdgeTrigInstance = {
          name: declName,
          trigType: typeText as 'R_TRIG' | 'F_TRIG',
          file: file.path,
          line: lineOf(decl),
          scope: qualified,
        };
        t.edgeTrigInstances.push(edge);
      }
      if (declName && BISTABLE_TYPE_NAMES.has(typeText)) {
        const bist: BistableInstance = {
          name: declName,
          bistableType: typeText as 'SR' | 'RS',
          file: file.path,
          line: lineOf(decl),
          scope: qualified,
        };
        t.bistableInstances.push(bist);
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
  collectMemberAccesses(file, node, qualified, t);
  collectWhileLoops(file, node, qualified, t);
  collectArrayAccesses(file, node, qualified, t);
  collectDivisions(file, node, qualified, t);
}

function collectMemberAccesses(
  file: AstFile,
  pouNode: StNode,
  scope: string,
  t: SymbolTable,
): void {
  for (const ma of descendantsOfType(pouNode, NODE.MEMBER_ACCESS)) {
    const kids = childrenOf(ma);
    if (kids.length < 2) continue;
    const ref: MemberAccess = {
      leftText: kids[0].text,
      rightText: kids[1].text,
      file: file.path,
      line: lineOf(ma),
      scope,
    };
    t.memberAccesses.push(ref);
  }
}

function collectWhileLoops(
  file: AstFile,
  pouNode: StNode,
  scope: string,
  t: SymbolTable,
): void {
  for (const ws of descendantsOfType(pouNode, NODE.WHILE_STATEMENT)) {
    const kids = childrenOf(ws);
    const condition = kids[0];
    if (!condition) continue;
    const hasExit = descendantsOfType(ws, NODE.EXIT_STATEMENT).length > 0;
    const w: WhileLoop = {
      file: file.path,
      line: lineOf(ws),
      scope,
      conditionText: condition.text.trim(),
      hasExit,
    };
    t.whileLoops.push(w);
  }
}

function collectArrayAccesses(
  file: AstFile,
  pouNode: StNode,
  scope: string,
  t: SymbolTable,
): void {
  for (const idx of descendantsOfType(pouNode, NODE.INDEX_EXPRESSION)) {
    const kids = childrenOf(idx);
    if (kids.length < 2) continue;
    const arr = kids[0];
    const subscript = kids[1];
    const indexText = subscript.text.trim();
    // parseStNumber returns null for non-literal subscripts (variables,
    // expressions), and correctly decodes radix/underscore/typed literals
    // (`16#FF`, `1_000`, `INT#10`) that a bare parseFloat would misread.
    const indexValue = parseStNumber(indexText);
    const access: ArrayAccess = {
      arrayName: arr.text.trim(),
      indexText,
      indexValue,
      file: file.path,
      line: lineOf(idx),
      scope,
    };
    t.arrayAccesses.push(access);
  }
}

function collectDivisions(
  file: AstFile,
  pouNode: StNode,
  scope: string,
  t: SymbolTable,
): void {
  for (const be of descendantsOfType(pouNode, NODE.BINARY_EXPRESSION)) {
    const hasDivOp = allChildrenOf(be).some((c) => c.type === '/');
    if (!hasDivOp) continue;
    const named = childrenOf(be);
    if (named.length < 2) continue;
    const rhs = named[named.length - 1];
    const div: DivisionExpr = {
      divisorText: rhs.text.trim(),
      file: file.path,
      line: lineOf(be),
      scope,
    };
    t.divisions.push(div);
  }
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
  // The BY step (4th named child, when present) is not always a simple literal:
  // `-2` is a single signed integer_literal, but `-STEP` parses as a
  // unary_expression and `(-2)` as a parenthesized_expression. Capture any
  // non-statement node in that slot so a valid descending loop with a
  // non-literal negative step isn't mistaken for one with no BY clause (which
  // defaults to +1 and would be misread as reversed). When there is no BY, this
  // slot holds the first body statement instead, which is excluded here.
  const isStepExpr = (n: StNode | undefined): boolean =>
    !!n &&
    !STATEMENT_TYPES.has(n.type) &&
    n.type !== NODE.COMMENT &&
    n.type !== 'empty_statement';
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
      by: isStepExpr(byNode) ? byNode.text : undefined,
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
  // Once we see a terminator (RETURN / EXIT / CONTINUE) in a block, every
  // subsequent statement in that same block is dead until the block ends —
  // L12: `RETURN; a; b; c;` should flag a, b, AND c, not just a. The terminator
  // sticks for the remainder of the loop over the current block's kids;
  // descending into a child node resets the picture for that child's own kids.
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
        // terminator stays set: every following statement in this block is
        // also unreachable; only descending into a fresh block resets it.
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
  // bare identifier, typically the second identifier child of the declaration.
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
      // `globalDecls` holds every site (H1: cross-file same-name globals are a
      // real bug we must not silently lose); `globals` keeps the last-write-
      // wins by-name index that existing `has`/`get` callers depend on.
      t.globalDecls.push(g);
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
    const namedArgs = new CaseMap<string>(t.caseSensitive);
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
      scope: pouContainingLine(t, file.path, lineOf(inv)),
      namedArgs,
      positionalArgs: positional,
      rawText: inv.text,
    };
    t.callSites.push(cs);
  }
}

/**
 * Lookup of the POU whose source range contains a given (file, line) pair.
 * Requires the line to lie within `[p.line, p.endLine]`, so lines above the
 * first POU, between POUs, or after the last POU are attributed to '<file>'.
 * When two POUs nest (a method inside an FB), the latest start wins — that's
 * the most specific (innermost) scope.
 *
 * Files containing exactly one top-level POU fall back to attributing any
 * otherwise-uncontained line to it. That covers synthetic fixtures (single-
 * line POU spans) without weakening the multi-POU case where the strict
 * containment check is the whole point of this function.
 */
function pouContainingLine(t: SymbolTable, file: string, line: number): string {
  let best: Pou | null = null;
  const topLevel: Pou[] = [];
  for (const p of t.pous.values()) {
    if (p.file !== file) continue;
    if (!p.parent) topLevel.push(p);
    if (line < p.line || line > p.endLine) continue;
    if (!best || p.line > best.line) best = p;
  }
  if (best) return best.qualifiedName;
  if (topLevel.length === 1) return topLevel[0].qualifiedName;
  return '<file>';
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
  collectMemberFieldAssignments(file, t, /^([A-Za-z_][A-Za-z0-9_]*)\.PT$/i, (name, value, line) => {
    t.timerPtAssignments.push({ timerName: name, ptValue: value, file: file.path, line });
  });
  collectMemberFieldAssignments(file, t, /^([A-Za-z_][A-Za-z0-9_]*)\.PV$/i, (name, value, line) => {
    t.counterPvAssignments.push({ counterName: name, pvValue: value, file: file.path, line });
  });

  // Named-arg calls: `T1(IN := xStart, PT := T#5s);`  or  `C1(PV := 10);`
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
    const pv = cs.namedArgs.get('PV');
    if (pv) {
      t.counterPvAssignments.push({
        counterName: cs.callee,
        pvValue: pv,
        file: file.path,
        line: cs.line,
      });
    }
  }
}

function collectMemberFieldAssignments(
  file: AstFile,
  _t: SymbolTable,
  pattern: RegExp,
  push: (instanceName: string, value: string, line: number) => void,
): void {
  for (const asn of descendantsOfType(file.root, NODE.ASSIGNMENT_STATEMENT)) {
    const lhs = childrenOf(asn).find(
      (c) => c.type === NODE.MEMBER_ACCESS || c.type === NODE.QUALIFIED_IDENTIFIER,
    );
    if (!lhs) continue;
    const m = pattern.exec(lhs.text.trim());
    if (!m) continue;
    const rhs = childrenOf(asn).find(
      (c) =>
        c.type === NODE.TIME_LITERAL ||
        c.type === NODE.INTEGER_LITERAL ||
        c.type === NODE.REAL_LITERAL ||
        c.type === NODE.IDENTIFIER,
    );
    if (!rhs) continue;
    push(m[1], rhs.text, lineOf(asn));
  }
}

// Classify an identifier node as a read or a write by walking up to the
// nearest assignment_statement and checking whether the identifier sits
// inside the LHS subtree (first named child). Identifiers not under any
// assignment are treated as reads. Returns 'unknown' only when parent
// links are unavailable (synthetic test fixtures don't populate them).
function refContext(node: StNode): VarReference['context'] {
  if (node.parent === undefined) return 'unknown';
  let child: StNode = node;
  let cur: StNode | null | undefined = node.parent;
  while (cur) {
    if (cur.type === NODE.ASSIGNMENT_STATEMENT) {
      const lhs = childrenOf(cur)[0];
      return lhs && sameNode(child, lhs) ? 'write' : 'read';
    }
    child = cur;
    cur = cur.parent ?? null;
  }
  return 'read';
}

// The tree-sitter binding hands back a fresh wrapper object on every `.parent`
// / child access, so the node reached by walking UP is never `===` the node
// reached by indexing DOWN even when they are the same syntax node. Compare by
// kind and source span instead, which is stable. Without this, an assignment's
// LHS identifier is misclassified as a read.
function sameNode(a: StNode, b: StNode): boolean {
  return (
    a.type === b.type &&
    a.startPosition.row === b.startPosition.row &&
    a.startPosition.column === b.startPosition.column &&
    a.endPosition.row === b.endPosition.row &&
    a.endPosition.column === b.endPosition.column
  );
}

// `ADR(x)` parses as its own `address_of_expression` node (not a
// call_expression), so it never reaches collectCallSites. Collect it
// directly so ADDRESS_OF_CONSTANT can see it.
function collectAddressOfExprs(file: AstFile, t: SymbolTable): void {
  for (const node of descendantsOfType(file.root, 'address_of_expression')) {
    const operandNode =
      node.childForFieldName?.('operand') ?? childrenOf(node)[0] ?? null;
    if (!operandNode) continue;
    const line = lineOf(node);
    t.addressOfExprs.push({
      operand: operandNode.text.trim(),
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    });
  }
}

function collectVarReferences(file: AstFile, t: SymbolTable): void {
  for (const ref of descendantsOfType(file.root, NODE.IDENTIFIER)) {
    const refText = ref.text;
    if (!refText) continue;
    const line = lineOf(ref);
    const v: VarReference = {
      name: refText,
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
      context: refContext(ref),
    };
    t.varReferences.push(v);
  }
}

// Structured statements whose grammar rule does NOT consume the trailing
// `;`: for these, the `;` after the closing keyword (END_FOR, END_IF,
// END_WHILE, END_CASE, END_REPEAT) parses as a standalone `empty_statement`
// node. That `;` is a statement terminator, not an intentional no-op,
// so we skip it. Statements that DO consume their `;`
// (assignment / invocation / return / exit / continue) don't need to be
// listed here, there's no phantom semicolon to skip.
const STRUCTURED_NON_SEMI_STATEMENTS = new Set<string>([
  'for_statement',
  'if_statement',
  'while_statement',
  'repeat_statement',
  'case_statement',
  'pragma',
]);

function collectFileScopedStatements(file: AstFile, t: SymbolTable): void {
  // Empty statements.
  for (const node of descendantsOfType(file.root, 'empty_statement')) {
    const prev = node.previousNamedSibling;
    if (prev && STRUCTURED_NON_SEMI_STATEMENTS.has(prev.type)) {
      continue; // grammar artifact, not a real empty statement
    }
    const line = lineOf(node);
    const e: EmptyStmt = {
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    };
    t.emptyStatements.push(e);
  }
  // Return points.
  for (const node of descendantsOfType(file.root, NODE.RETURN_STATEMENT)) {
    const line = lineOf(node);
    const r: ReturnPoint = {
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    };
    t.returnPoints.push(r);
  }
  // Assignment LHS targets.
  for (const asn of descendantsOfType(file.root, NODE.ASSIGNMENT_STATEMENT)) {
    const kids = childrenOf(asn);
    const lhs = kids[0];
    if (!lhs) continue;
    const raw = lhs.text;
    // Extract the leading identifier from the LHS (`T1.PT` → `T1`, `arr[5]` → `arr`).
    const m = /^([A-Za-z_][A-Za-z0-9_]*)/.exec(raw.trim());
    if (!m) continue;
    const line = lineOf(asn);
    const target: AssignmentTarget = {
      name: m[1],
      rawText: raw.trim(),
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    };
    t.assignmentTargets.push(target);
  }
}

function collectComments(file: AstFile, t: SymbolTable): void {
  for (const node of descendantsOfType(file.root, NODE.COMMENT)) {
    const line = lineOf(node);
    const c: CommentNode = {
      text: node.text,
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    };
    t.comments.push(c);
  }
}

// PLCopen N1 / CP1 — every `%I0.0` / `%Q1.2` etc. parses as `direct_address`.
function collectDirectAddresses(file: AstFile, t: SymbolTable): void {
  for (const node of descendantsOfType(file.root, NODE.DIRECT_ADDRESS)) {
    const line = lineOf(node);
    t.directAddresses.push({
      text: node.text.trim(),
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    });
  }
}

// PLCopen L17 — an IF without a final ELSE clause. ELSIF doesn't count.
function collectIfStatements(file: AstFile, t: SymbolTable): void {
  for (const node of descendantsOfType(file.root, NODE.IF_STATEMENT)) {
    const line = lineOf(node);
    const hasElse = childrenOf(node).some((c) => c.type === NODE.ELSE_CLAUSE);
    t.ifStatements.push({
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
      hasElse,
    });
  }
}

// PLCopen L10 — flag EXIT / CONTINUE / GOTO use sites. RETURN is also
// collected (already used by MULTIPLE_EXIT_POINTS via `returnPoints`, but
// kept here too for a unified "restricted statement" view if needed later).
function collectRestrictedStatements(file: AstFile, t: SymbolTable): void {
  const kinds: Array<{ node: string; kind: 'EXIT' | 'CONTINUE' | 'GOTO' | 'RETURN' }> = [
    { node: NODE.EXIT_STATEMENT, kind: 'EXIT' },
    { node: NODE.CONTINUE_STATEMENT, kind: 'CONTINUE' },
    { node: NODE.GOTO_STATEMENT, kind: 'GOTO' },
  ];
  for (const { node: type, kind } of kinds) {
    for (const n of descendantsOfType(file.root, type)) {
      const line = lineOf(n);
      t.restrictedStatements.push({
        kind,
        file: file.path,
        line,
        scope: pouContainingLine(t, file.path, line),
      });
    }
  }
}

// PLCopen E2 / E3 — binary expressions, used to spot arithmetic /
// comparisons whose operand is a POINTER-typed local.
function collectBinaryExpressions(file: AstFile, t: SymbolTable): void {
  for (const node of descendantsOfType(file.root, NODE.BINARY_EXPRESSION)) {
    const kids = childrenOf(node);
    if (kids.length < 2) continue;
    // The operator is one of the child *tokens* (non-named in tree-sitter),
    // not a named child. Look across all raw children for a non-named one.
    let op = '';
    for (const raw of allChildrenOf(node)) {
      if (kids.includes(raw)) continue; // named operand
      const t2 = raw.type;
      if (t2.length <= 3 && /[-+*/=<>&|]/.test(t2)) {
        op = t2;
        break;
      }
    }
    const leftText = kids[0].text.trim();
    const rightText = kids[kids.length - 1].text.trim();
    const line = lineOf(node);
    t.binaryExpressions.push({
      op,
      leftText,
      rightText,
      file: file.path,
      line,
      scope: pouContainingLine(t, file.path, line),
    });
  }
}
