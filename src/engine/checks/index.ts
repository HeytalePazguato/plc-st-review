import type { Check } from '../types.js';
import { arrayBoundsChanged } from './array-bounds-changed.js';
import { callSiteOutdated } from './call-site-outdated.js';
import { commentOnly } from './comment-only.js';
import { constantValueChanged } from './constant-value-changed.js';
import { enumValueAdded } from './enum-value-added.js';
import { enumValueRemoved } from './enum-value-removed.js';
import { inheritanceChanged } from './inheritance-changed.js';
import { loopBoundsChanged } from './loop-bounds-changed.js';
import { methodAddedToInterface } from './method-added-to-interface.js';
import { pouDeleted } from './pou-deleted.js';
import { pouRenamed } from './pou-renamed.js';
import { pragmaChanged } from './pragma-changed.js';
import { signatureChanged } from './signature-changed.js';
import { stateUnhandled } from './state-unhandled.js';
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
  ];
}
