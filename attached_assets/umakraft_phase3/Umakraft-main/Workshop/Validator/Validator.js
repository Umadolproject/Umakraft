/**
 * Validator
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Validator — Stage 3, Workshop
 *
 * Sole responsibility: inspect Fabricator deliverables and confirm they
 * satisfy Draftsman specifications before they enter the Terminal.
 *
 * Runs 5 sequential validation categories. Never modifies deliverables.
 * Fabricator failure envelopes are passed through unchanged.
 */

import { validateExistence }            from './validation/existence.js';
import { validateStructure }            from './validation/structure.js';
import { validateBlueprintRegistration } from './validation/blueprintRegistration.js';
import { validateOutputIntegrity }      from './validation/outputIntegrity.js';
import { validateMetadataConsistency }  from './validation/metadataConsistency.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'validator',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Validation pipeline ──────────────────────────────────────────────────────

const VALIDATORS = [
  { category: 'EXISTENCE',             fn: validateExistence            },
  { category: 'STRUCTURE',             fn: validateStructure            },
  { category: 'BLUEPRINT_REGISTRATION', fn: validateBlueprintRegistration },
  { category: 'OUTPUT_INTEGRITY',      fn: validateOutputIntegrity      },
  { category: 'METADATA_CONSISTENCY',  fn: validateMetadataConsistency  },
];

function runValidation(deliverable) {
  for (const { category, fn } of VALIDATORS) {
    const result = fn(deliverable);
    if (!result.ok) {
      return { accepted: false, category, reason: result.reason };
    }
  }
  return { accepted: true };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Inspect a Fabricator deliverable.
 *
 * Fabricator failure envelopes (success: false) are passed through unchanged.
 * Success envelopes run all 5 validation categories sequentially.
 *
 * @param {object} deliverable — from Fabricator
 * @returns {ValidatorResult}
 */
export function validate(deliverable) {
  try {
    // Pass through Fabricator failure envelopes unchanged
    if (deliverable?.success === false) {
      log('info', `passing through fabricator failure — ${deliverable.error ?? 'unknown error'}`);
      return deliverable;
    }

    const validation = runValidation(deliverable);

    if (!validation.accepted) {
      log('warn', `rejected — ${validation.category}_FAILURE: ${validation.reason}`, {
        blueprintKey: deliverable?.blueprintKey,
      });
      return reject(validation.category, validation.reason, deliverable);
    }

    log('info', `approved — blueprintKey=${deliverable.blueprintKey}`, {
      blueprintName: deliverable.blueprintName,
    });
    return approve(deliverable);

  } catch (err) {
    log('error', `unexpected error during validation: ${err.message}`);
    return reject('EXISTENCE', `Validator encountered an unexpected error: ${err.message}`, deliverable);
  }
}

/**
 * Format an approved deliverable for the Terminal.
 *
 * @param {object} deliverable — validated deliverable
 * @returns {ApprovedEnvelope}
 */
export function approve(deliverable) {
  return {
    success:           true,
    approved:          true,
    blueprintKey:      deliverable.blueprintKey,
    blueprintName:     deliverable.blueprintName,
    trigger:           deliverable.trigger,
    type:              deliverable.type,
    png:               deliverable.png,
    meta:              deliverable.meta,
    validatedAt:       new Date().toISOString(),
    fabricatorVersion: deliverable.fabricatorVersion,
  };
}

/**
 * Format a rejected deliverable.
 *
 * @param {string} category   — which validation category failed
 * @param {string} reason     — human-readable explanation
 * @param {object} deliverable — original deliverable (preserved for diagnostics)
 * @returns {RejectedEnvelope}
 */
export function reject(category, reason, deliverable) {
  return {
    success:   false,
    approved:  false,
    error:     `${category}_FAILURE`,
    message:   `${category}_FAILURE: ${reason}`,
    retriable: false,
    timestamp: new Date().toISOString(),
    context: {
      blueprintKey:  deliverable?.blueprintKey ?? null,
      originalData:  deliverable,
    },
  };
}

/**
 * Produce a validation summary for a deliverable.
 *
 * @param {object} deliverable
 * @returns {ValidationReport}
 */
export function report(deliverable) {
  const validation = runValidation(deliverable);
  return {
    blueprintKey: deliverable?.blueprintKey ?? null,
    passed:       validation.accepted,
    failedAt:     validation.accepted ? null : validation.category,
    reason:       validation.accepted ? null : validation.reason,
    checkedAt:    new Date().toISOString(),
  };
}
