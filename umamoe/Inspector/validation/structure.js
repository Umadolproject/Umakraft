/**
 * Inspector — Validation Category 2: Structure
 *
 * Checks that data is a plain object (not an array, function, etc.).
 */

/**
 * @param {*} data
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateStructure(data) {
  if (typeof data !== 'object') {
    return { ok: false, reason: `Expected object, got ${typeof data}` };
  }
  if (Array.isArray(data)) {
    return { ok: false, reason: 'Expected object, got array' };
  }
  return { ok: true };
}
