/**
 * Inspector
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Inspector — Stage 1, Umamoe
 *
 * Sole responsibility: validate data integrity before it enters the Vault.
 * Runs 5 validation categories. Never stores or transforms data.
 */

import { validateExistence }     from './validation/existence.js';
import { validateStructure }     from './validation/structure.js';
import { validateCompleteness }  from './validation/completeness.js';
import { validateTypeIntegrity } from './validation/typeIntegrity.js';
import { validateRangeIntegrity} from './validation/rangeIntegrity.js';
import { formatRejection, formatAcceptance } from './errors.js';
import { logAccepted, logRejected, logPassthrough, logError } from './logging.js';

// ─── Validation pipeline ──────────────────────────────────────────────────────

const VALIDATORS = [
  { category: 'EXISTENCE',       fn: validateExistence },
  { category: 'STRUCTURE',       fn: validateStructure },
  { category: 'COMPLETENESS',    fn: validateCompleteness },
  { category: 'TYPE_INTEGRITY',  fn: validateTypeIntegrity },
  { category: 'RANGE_INTEGRITY', fn: validateRangeIntegrity },
];

function runValidation(data) {
  for (const { category, fn } of VALIDATORS) {
    const result = fn(data);
    if (!result.ok) {
      return { accepted: false, category, reason: result.reason };
    }
  }
  return { accepted: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inspect a Miner/Courier envelope.
 *
 * - Failure envelopes (success: false) are passed through unchanged.
 * - Success envelopes (success: true) run all 5 validation categories.
 *
 * @param {object} envelope — from Courier
 * @returns {InspectorResult}
 */
export function inspect(envelope) {
  try {
    // Pass through Miner failure envelopes unchanged
    if (envelope?.success === false) {
      logPassthrough(envelope.error ?? 'unknown error');
      return envelope;
    }

    const data = envelope?.data;
    const validation = runValidation(data);

    if (!validation.accepted) {
      logRejected(`${validation.category}_FAILURE`, validation.reason);
      return formatRejection(validation.category, validation.reason, data);
    }

    logAccepted(data?.id);
    return formatAcceptance(data);

  } catch (err) {
    logError(`Unexpected error during inspection: ${err.message}`);
    return formatRejection('EXISTENCE', `Inspector encountered an unexpected error: ${err.message}`, envelope);
  }
}
