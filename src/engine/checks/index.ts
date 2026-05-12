import type { Check } from '../types.js';
import { arrayBoundsChanged } from './array-bounds-changed.js';
import { arrayIndexOutOfBounds } from './array-index-out-of-bounds.js';
import { bistableDominanceMismatch } from './bistable-dominance-mismatch.js';
import { callSiteOutdated } from './call-site-outdated.js';
import { commentOnly } from './comment-only.js';
import { constantValueChanged } from './constant-value-changed.js';
import { counterPvZero } from './counter-pv-zero.js';
import { counterValueChanged } from './counter-value-changed.js';
import { divisionByZero } from './division-by-zero.js';
import { edgeTrigReused } from './edge-trig-reused.js';
import { enumMemberUnknown } from './enum-member-unknown.js';
import { enumValueAdded } from './enum-value-added.js';
import { enumValueRemoved } from './enum-value-removed.js';
import { enumValueUnused } from './enum-value-unused.js';
import { fbInstanceDoubleCall } from './fb-instance-double-call.js';
import { fbInstanceNeverCalled } from './fb-instance-never-called.js';
import { infiniteLoop } from './infinite-loop.js';
import { inheritanceChanged } from './inheritance-changed.js';
import { loopBoundsChanged } from './loop-bounds-changed.js';
import { loopBoundsReversed } from './loop-bounds-reversed.js';
import { methodAddedToInterface } from './method-added-to-interface.js';
import { pouDeleted } from './pou-deleted.js';
import { pouRenamed } from './pou-renamed.js';
import { pragmaChanged } from './pragma-changed.js';
import { signatureChanged } from './signature-changed.js';
import { stateUnhandled } from './state-unhandled.js';
import { timerNotDriven } from './timer-not-driven.js';
import { timerPtZero } from './timer-pt-zero.js';
import { timerValueChanged } from './timer-value-changed.js';
import { typeMismatch } from './type-mismatch.js';
import { unreachableCode } from './unreachable-code.js';
import { unusedVarIntroduced } from './unused-var-introduced.js';

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
  ];
}
