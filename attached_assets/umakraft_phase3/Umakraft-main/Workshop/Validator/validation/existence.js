/**
 * Validator — Validation Category 1: Existence
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Validator — Stage 3, Workshop
 *
 * Confirms the deliverable envelope exists and declares success.
 */

/**
 * @param {*} deliverable
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateExistence(deliverable) {
  if (deliverable === null || deliverable === undefined) {
    return { ok: false, reason: 'Deliverable is null or undefined' };
  }
  if (typeof deliverable !== 'object' || Array.isArray(deliverable)) {
    return { ok: false, reason: `Deliverable is not an object, got ${Array.isArray(deliverable) ? 'array' : typeof deliverable}` };
  }
  if (deliverable.success !== true) {
    return { ok: false, reason: 'Deliverable success flag is not true' };
  }
  return { ok: true };
}
