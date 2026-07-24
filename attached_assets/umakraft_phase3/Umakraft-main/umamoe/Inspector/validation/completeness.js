/**
 * Inspector — Validation Category 3: Completeness
 *
 * Checks that all required fields are present and non-null.
 */

const REQUIRED_FIELDS = ['id', 'name', 'fans', 'rank'];

/**
 * @param {object} data
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateCompleteness(data) {
  for (const field of REQUIRED_FIELDS) {
    if (!(field in data)) {
      return { ok: false, reason: `Required field '${field}' is missing` };
    }
    if (data[field] === null || data[field] === undefined) {
      return { ok: false, reason: `Required field '${field}' is null or undefined` };
    }
  }
  return { ok: true };
}
