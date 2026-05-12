// Manual demo script (not part of vitest). Run with:
//   npx tsx test/sample-run-demo.ts
// Shows the renderer output a real CLI invocation would produce once the
// tree-sitter grammar binding is available.
import { renderTerminal } from '../src/output/terminal.js';
import {
  fbDecl,
  globalsBlock,
  invocation,
  localVars,
  paramDecl,
  programDecl,
  ptAssignment,
  resetLines,
  sourceFile,
} from './helpers/ast-fixtures.js';
import { review } from './helpers/review.js';

resetLines();
const beforeFb = sourceFile('FB_Startup.st', [
  fbDecl('FB_Startup', {
    locals: [
      localVars({}, paramDecl({ name: 'T_StartupDelay', type: 'TON' })),
      ptAssignment('T_StartupDelay', 'T#5s'),
    ],
  }),
]);
resetLines();
const beforeMain = sourceFile('MAIN.st', [
  programDecl('MAIN', [invocation('FB_Pump', { xEnable: 'TRUE' })]),
]);
resetLines();
const beforePump = sourceFile('FB_Pump.st', [
  fbDecl('FB_Pump', { inputs: [{ name: 'xEnable', type: 'BOOL' }] }),
]);
resetLines();
const beforeGlobals = sourceFile('Globals.st', [
  globalsBlock([{ name: 'SAFETY_TIMEOUT', type: 'INT', initial: '500', constant: true }]),
]);

resetLines();
const afterFb = sourceFile('FB_Startup.st', [
  fbDecl('FB_Startup', {
    locals: [
      localVars({}, paramDecl({ name: 'T_StartupDelay', type: 'TON' })),
      ptAssignment('T_StartupDelay', 'T#500ms'),
    ],
  }),
]);
resetLines();
const afterMain = sourceFile('MAIN.st', [
  programDecl('MAIN', [invocation('FB_Pump', { xEnable: 'TRUE' })]),
]);
resetLines();
const afterPump = sourceFile('FB_Pump.st', [
  fbDecl('FB_Pump', {
    inputs: [
      { name: 'xEnable', type: 'BOOL' },
      { name: 'xManualOverride', type: 'BOOL' },
    ],
  }),
]);
resetLines();
const afterGlobals = sourceFile('Globals.st', [
  globalsBlock([{ name: 'SAFETY_TIMEOUT', type: 'INT', initial: '1500', constant: true }]),
]);

const findings = review(
  [beforeFb, beforeMain, beforePump, beforeGlobals],
  [afterFb, afterMain, afterPump, afterGlobals],
);

process.stdout.write(renderTerminal(findings, { color: true }) + '\n');
