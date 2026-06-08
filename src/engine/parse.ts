import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Language, Parser } from 'web-tree-sitter';
import type { AstFile, StNode } from './types.js';

/**
 * Per-file source-length cap, in UTF-16 code units. Real-world ST files are
 * typically well under this; the cap is a safety net so a single pathologically
 * large or hostile file can't blow up memory or time in the tree-sitter
 * WebAssembly parser. When exceeded, the file is skipped with a stderr warning and
 * represented in the symbol table by an empty AST so downstream checks treat
 * it as a no-op rather than crashing.
 *
 * Mutable so the CLI can override it from `.plc-st-review.yml`
 * (`parsing.max_file_size_bytes`) or `--max-file-size`. A value of `0` (or
 * negative) disables the cap entirely.
 */
let maxSourceLength = 1_000_000;

/**
 * Override the per-file size cap used by `parseSource`. Called by the CLI
 * after the resolved config is known; tests can use it to exercise the cap
 * at smaller sizes.
 */
export function setMaxSourceLength(n: number): void {
  maxSourceLength = Number.isFinite(n) && n > 0 ? n : 0;
}

function emptyRoot(): StNode {
  return {
    type: 'source_file',
    text: '',
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
    children: [],
    namedChildren: [],
  };
}

/**
 * A ready-to-use parser whose language is the IEC 61131-3 ST grammar. We hold a
 * single shared instance: `web-tree-sitter` is async to initialise (it boots a
 * WebAssembly runtime and loads the grammar's `.wasm`), so we do that once and
 * reuse it for every file in the run.
 */
let loaded: Parser | null = null;
let loadPromise: Promise<Parser> | null = null;

async function loadParser(): Promise<Parser> {
  if (loaded) return loaded;
  // Collapse concurrent first-time loads onto a single init: parsing kicks off
  // many files in parallel, and `Parser.init()` must run exactly once.
  if (!loadPromise) {
    loadPromise = initParser().catch((err) => {
      // Reset so a transient failure can be retried on the next call rather
      // than poisoning the cached promise for the rest of the process.
      loadPromise = null;
      throw new Error(
        'Failed to initialise the tree-sitter-iec61131-3-st WebAssembly parser. ' +
          'Ensure `web-tree-sitter` and `tree-sitter-iec61131-3-st` are installed. ' +
          `Underlying cause: ${(err as Error).message}`,
        { cause: err as Error },
      );
    });
  }
  loaded = await loadPromise;
  return loaded;
}

async function initParser(): Promise<Parser> {
  const require = createRequire(import.meta.url);
  // The grammar package ships the wasm at its root as
  // `tree-sitter-iec61131_3_st.wasm` (note the `_3_st`, not `-3-st`); resolve
  // it through the package so we never hardcode a node_modules path.
  const wasmPath = require.resolve(
    'tree-sitter-iec61131-3-st/tree-sitter-iec61131_3_st.wasm',
  );
  await Parser.init();
  const language = await Language.load(wasmPath);
  const parser = new Parser();
  parser.setLanguage(language);
  return parser;
}

export async function parseSource(
  source: string,
  path: string,
): Promise<AstFile> {
  if (maxSourceLength > 0 && source.length > maxSourceLength) {
    process.stderr.write(
      `plc-st-review: skipping ${path} (size ${source.length} > cap ${maxSourceLength}); treated as empty\n`,
    );
    return { path, source: '', root: emptyRoot() };
  }
  const parser = await loadParser();
  const tree = parser.parse(source);
  if (!tree) {
    process.stderr.write(
      `plc-st-review: parser returned no tree for ${path}; treated as empty\n`,
    );
    return { path, source: '', root: emptyRoot() };
  }
  return { path, source, root: tree.rootNode as unknown as StNode };
}

export async function parseFile(absPath: string, relPath: string): Promise<AstFile> {
  const source = await readFile(absPath, 'utf8');
  return parseSource(source, relPath);
}

/**
 * Synchronous parse helper used by tests that already hold a parsed root node.
 * Not for production paths.
 */
export function astFileFromRoot(
  path: string,
  source: string,
  root: StNode,
): AstFile {
  return { path, source, root };
}
