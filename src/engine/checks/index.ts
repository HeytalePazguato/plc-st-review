import type { Category, Check } from '../types.js';
import { addressOfConstant } from './address-of-constant.js';
import { arrayBoundsChanged } from './array-bounds-changed.js';
import { arrayIndexOutOfBounds } from './array-index-out-of-bounds.js';
import { arraySingleElement } from './array-single-element.js';
import { assignmentInCondition } from './assignment-in-condition.js';
import { bistableDominanceMismatch } from './bistable-dominance-mismatch.js';
import { boolComparison } from './bool-comparison.js';
import { callSiteOutdated } from './call-site-outdated.js';
import { commentedOutCode } from './commented-out-code.js';
import { commentOnly } from './comment-only.js';
import { complexityIncreased } from './complexity-increased.js';
import { constantValueChanged } from './constant-value-changed.js';
import { deadPouIntroduced } from './dead-pou-introduced.js';
import { counterPvZero } from './counter-pv-zero.js';
import { counterValueChanged } from './counter-value-changed.js';
import { divisionByZero } from './division-by-zero.js';
import { edgeTrigReused } from './edge-trig-reused.js';
import { emptyStatement } from './empty-statement.js';
import { enumMemberUnknown } from './enum-member-unknown.js';
import { enumValueAdded } from './enum-value-added.js';
import { enumValueRemoved } from './enum-value-removed.js';
import { enumValueUnused } from './enum-value-unused.js';
import { fbInstanceDoubleCall } from './fb-instance-double-call.js';
import { fbInstanceNeverCalled } from './fb-instance-never-called.js';
import { forbiddenSymbol } from './forbidden-symbol.js';
import { identifierCaseMismatch } from './identifier-case-mismatch.js';
import { infiniteLoop } from './infinite-loop.js';
import { inheritanceChanged } from './inheritance-changed.js';
import { inputVarWritten } from './input-var-written.js';
import { locSpike } from './loc-spike.js';
import { loopBoundsChanged } from './loop-bounds-changed.js';
import { loopBoundsReversed } from './loop-bounds-reversed.js';
import { methodAddedToInterface } from './method-added-to-interface.js';
import { multipleExitPoints } from './multiple-exit-points.js';
import { namingConvention } from './naming-convention.js';
import { nestedComments } from './nested-comments.js';
import { nestingIncreased } from './nesting-increased.js';
import { outputVarReadInternally } from './output-var-read-internally.js';
import { pouDeleted } from './pou-deleted.js';
import { pouRenamed } from './pou-renamed.js';
import { pragmaChanged } from './pragma-changed.js';
import { realEquality } from './real-equality.js';
import { recursiveCall } from './recursive-call.js';
import { signatureChanged } from './signature-changed.js';
import { stateUnhandled } from './state-unhandled.js';
import { timerNotDriven } from './timer-not-driven.js';
import { timerPtZero } from './timer-pt-zero.js';
import { timerValueChanged } from './timer-value-changed.js';
import { typeMismatch } from './type-mismatch.js';
import { unqualifiedEnumConstant } from './unqualified-enum-constant.js';
import { unreachableCode } from './unreachable-code.js';
import { unusedInputVar } from './unused-input-var.js';
import { unusedOutputVar } from './unused-output-var.js';
import { unusedReturnValue } from './unused-return-value.js';
import { unusedVarIntroduced } from './unused-var-introduced.js';
import { variableShadowing } from './variable-shadowing.js';

export function allChecks(): Check[] {
  return [
    signatureChanged,
    callSiteOutdated,
    typeMismatch,
    enumValueRemoved,
    enumValueAdded,
    timerValueChanged,
    constantValueChanged,
    commentOnly,
    arrayBoundsChanged,
    stateUnhandled,
    unreachableCode,
    loopBoundsChanged,
    pouDeleted,
    pouRenamed,
    methodAddedToInterface,
    inheritanceChanged,
    pragmaChanged,
    unusedVarIntroduced,
    enumValueUnused,
    enumMemberUnknown,
    arrayIndexOutOfBounds,
    divisionByZero,
    infiniteLoop,
    loopBoundsReversed,
    counterValueChanged,
    counterPvZero,
    timerPtZero,
    timerNotDriven,
    edgeTrigReused,
    fbInstanceDoubleCall,
    fbInstanceNeverCalled,
    bistableDominanceMismatch,
    emptyStatement,
    unusedReturnValue,
    arraySingleElement,
    variableShadowing,
    unqualifiedEnumConstant,
    identifierCaseMismatch,
    unusedInputVar,
    inputVarWritten,
    boolComparison,
    realEquality,
    multipleExitPoints,
    assignmentInCondition,
    commentedOutCode,
    recursiveCall,
    forbiddenSymbol,
    addressOfConstant,
    unusedOutputVar,
    outputVarReadInternally,
    nestedComments,
    namingConvention,
    complexityIncreased,
    nestingIncreased,
    locSpike,
    deadPouIntroduced,
  ];
}

/** Categories whose checks need `ctx.project` (the whole-repo symbol table). */
export function projectScopedCategories(): Category[] {
  return allChecks()
    .filter((c) => c.scope === 'project')
    .map((c) => c.category);
}
