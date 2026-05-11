import type { Check } from '../types.js';
import { signatureChanged } from './signature-changed.js';
import { callSiteOutdated } from './call-site-outdated.js';
import { typeMismatch } from './type-mismatch.js';
import { enumValueRemoved } from './enum-value-removed.js';
import { enumValueAdded } from './enum-value-added.js';
import { timerValueChanged } from './timer-value-changed.js';
import { constantValueChanged } from './constant-value-changed.js';
import { commentOnly } from './comment-only.js';

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
  ];
}
