/**
 * Inspector — Validation Category 1: Existence
 *
 * Checks that data is not null, undefined, or empty.
 */

/**
 * @param {*} data
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateExistence(data) {
  if (data === null || data === undefined) {
    return { ok: false, reason: 'Data is null or undefined' };
  }
  if (typeof data === 'string' && data.trim() === '') {
    return { ok: false, reason: 'Data is an empty string' };
  }
  return { ok: true };
}
