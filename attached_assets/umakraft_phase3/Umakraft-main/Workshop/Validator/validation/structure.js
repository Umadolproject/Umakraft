/**
 * Validator — Validation Category 2: Structure
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Validator — Stage 3, Workshop
 *
 * Confirms all required envelope fields are present and non-null.
 */

const REQUIRED_STRING_FIELDS = ['blueprintKey', 'blueprintName', 'trigger', 'renderedAt'];
const VALID_TYPES = ['command', 'broadcast'];

/**
 * @param {object} deliverable
 * @returns {{ ok: boolean, reason?: string }}
 */
export function validateStructure(deliverable) {
  for (const field of REQUIRED_STRING_FIELDS) {
    if (!deliverable[field] || typeof deliverable[field] !== 'string') {
      return { ok: false, reason: `Missing or invalid ${field}` };
    }
  }

  if (!VALID_TYPES.includes(deliverable.type)) {
    return {
      ok: false,
      reason: `type must be "command" or "broadcast", got ${JSON.stringify(deliverable.type)}`,
    };
  }

  if (deliverable.png === null || deliverable.png === undefined) {
    return { ok: false, reason: 'Missing png field' };
  }

  return { ok: true };
}
