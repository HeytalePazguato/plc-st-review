import { readFile } from 'node:fs/promises';
import type { AstFile, StNode } from './types.js';

/**
 * Hard cap on per-file source length, in UTF-16 code units. Real-world ST
 * files are typically well under this; the cap is a safety net so a single
 * pathologically large or hostile file can't blow up memory or time in the
 * tree-sitter native parser. When exceeded, the file is skipped with a
 * stderr warning and represented in the symbol table by an empty AST so
 * downstream checks treat it as a no-op rather than crashing.
 */
const MAX_SOURCE_LENGTH = 1_000_000;

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

interface ParserCtor {
  new (): ParserInstance;
}

interface ParserInstance {
  setLanguage(lang: unknown): void;
  parse(source: string): { rootNode: StNode };
}

interface LoadedParser {
  Parser: ParserCtor;
  language: unknown;
}

let loaded: LoadedParser | null = null;
let loadError: Error | null = null;

async function loadParser(): Promise<LoadedParser> {
  if (loaded) return loaded;
  if (loadError) throw loadError;
  try {
    const treeSitter = await import('tree-sitter');
    const grammar = await import('tree-sitter-iec61131-3-st');
    const Parser = (treeSitter as { default?: ParserCtor }).default ??
      (treeSitter as unknown as ParserCtor);
    const language =
      (grammar as { default?: unknown }).default ??
      (grammar as unknown);
    loaded = { Parser, language };
    return loaded;
  } catch (err) {
    loadError = new Error(
      'Failed to load tree-sitter-iec61131-3-st native binding. ' +
        'Ensure the grammar is built (see README "Grammar build" section). ' +
        `Underlying cause: ${(err as Error).message}`,
      { cause: err as Error },
    );
    throw loadError;
  }
}

export async function parseSource(
  source: string,
  path: string,
): Promise<AstFile> {
  if (source.length > MAX_SOURCE_LENGTH) {
    process.stderr.write(
      `plc-st-review: skipping ${path} (size ${source.length} > cap ${MAX_SOURCE_LENGTH}); treated as empty\n`,
    );
    return { path, source: '', root: emptyRoot() };
  }
  const { Parser, language } = await loadParser();
  const parser = new Parser();
  parser.setLanguage(language);
  const tree = parser.parse(source);
  return { path, source, root: tree.rootNode };
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
