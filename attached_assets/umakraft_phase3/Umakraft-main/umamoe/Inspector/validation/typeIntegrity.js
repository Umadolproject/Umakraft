/**
 * Inspector — Validation Category 4: Type Integrity
 *
 * Checks that each field carries the correct JavaScript type.
 */

const FIELD_TYPES = {
  id:           'string',
  name:         'string',
  fans:         'number',
  rank:         'number',
  characters:   'array',    // custom — checked below
  achievements: 'array',    // custom — checked below
};

/**
 * @param {object} data
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateTypeIntegrity(data) {
  for (const [field, expected] of Object.entries(FIELD_TYPES)) {
    if (!(field in data)) continue; // completeness check owns missing fields

    const value = data[field];

    if (expected === 'array') {
      if (!Array.isArray(value)) {
        return {
          ok: false,
          reason: `Field '${field}' must be an array, got ${typeof value}`,
        };
      }
    } else {
      if (typeof value !== expected) {
        return {
          ok: false,
          reason: `Field '${field}' must be ${expected}, got ${typeof value}`,
        };
      }
    }
  }
  return { ok: true };
}
