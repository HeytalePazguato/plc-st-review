export { runReview, summary, shouldFail } from './engine/review.js';
export { renderTerminal } from './output/terminal.js';
export { renderMarkdown } from './output/markdown.js';
export { renderJson } from './output/json.js';
export { loadConfig, resolveConfig, DEFAULT_CONFIG } from './config.js';
export { loadRefSnapshot, loadPathPair } from './platforms/local.js';
export {
  loadGitlabMrSnapshot,
  postGitlabReview,
  resolveGitlabOptionsFromEnv,
} from './platforms/gitlab.js';
export { parseSource, parseFile, astFileFromRoot } from './engine/parse.js';
export type {
  AstFile,
  Category,
  Check,
  Finding,
  Pou,
  Parameter,
  ResolvedConfig,
  ReviewContext,
  Severity,
  StNode,
  SymbolTable,
} from './engine/types.js';
