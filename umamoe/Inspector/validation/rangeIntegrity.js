/**
 * Inspector — Validation Category 5: Range Integrity
 *
 * Checks that numeric fields fall within acceptable value ranges.
 */

const RANGE_RULES = [
  {
    field: 'fans',
    min: 0,
    max: Infinity,
    reason: (v) => `Field 'fans' must be >= 0, got ${v}`,
  },
  {
    field: 'rank',
    min: 1,
    max: 10000,
    reason: (v) => `Field 'rank' must be 1–10000, got ${v}`,
  },
];

/**
 * @param {object} data
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateRangeIntegrity(data) {
  for (const rule of RANGE_RULES) {
    if (!(rule.field in data)) continue; // completeness check owns missing fields

    const value = data[rule.field];
    if (typeof value !== 'number') continue; // type check owns type mismatches

    if (value < rule.min || value > rule.max) {
      return { ok: false, reason: rule.reason(value) };
    }
  }
  return { ok: true };
}
