/**
 * Validator — Validation Category 5: Metadata Consistency
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Validator — Stage 3, Workshop
 *
 * Confirms deliverable metadata is internally consistent and contains
 * the minimum required fields.
 */

/**
 * @param {object} deliverable
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateMetadataConsistency(deliverable) {
  const { meta, renderedAt, fabricatorVersion } = deliverable;

  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) {
    return { ok: false, reason: 'meta is not a plain object' };
  }

  if (isNaN(Date.parse(renderedAt))) {
    return { ok: false, reason: `renderedAt is not a valid ISO 8601 date: "${renderedAt}"` };
  }

  if (!fabricatorVersion || typeof fabricatorVersion !== 'string') {
    return { ok: false, reason: 'Missing or invalid fabricatorVersion' };
  }

  return { ok: true };
}
