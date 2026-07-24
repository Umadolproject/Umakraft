/**
 * Inspector — Error Formatter
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Inspector — Stage 1, Umamoe
 *
 * Produces rejection envelopes in the standard format.
 * All rejection codes follow: {CATEGORY}_FAILURE
 */

/**
 * Format a rejection result from the Inspector.
 *
 * @param {string} category  — e.g. 'EXISTENCE', 'STRUCTURE'
 * @param {string} reason    — human-readable explanation
 * @param {*}      data      — original data (preserved for diagnostics)
 * @returns {{ success: false, accepted: false, error: string, message: string, retriable: boolean, timestamp: string, context: object }}
 */
export function formatRejection(category, reason, data) {
  return {
    success: false,
    accepted: false,
    error: `${category}_FAILURE`,
    message: `${category}_FAILURE: ${reason}`,
    retriable: false,
    timestamp: new Date().toISOString(),
    context: { originalData: data },
  };
}

/**
 * Format an acceptance result from the Inspector.
 *
 * @param {*} data — validated, trusted data
 * @returns {{ success: true, accepted: true, data: *, inspectedAt: string }}
 */
export function formatAcceptance(data) {
  return {
    success: true,
    accepted: true,
    data,
    inspectedAt: new Date().toISOString(),
  };
}
