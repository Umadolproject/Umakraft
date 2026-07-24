/**
 * Terminal — Memory Storage Adapter
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Terminal — Stage 3, Workshop
 *
 * In-memory adapter for development and testing.
 * Implements the Terminal adapter contract (put / get / list / del).
 * Replace with a persistent adapter in production.
 */

// key: terminalId, value: TerminalRecord
const store = new Map();

/**
 * Store a terminal record.
 *
 * @param {object} record — full TerminalRecord with terminalId
 * @returns {{ success: boolean, error?: string, message?: string }}
 */
export async function put(record) {
  try {
    if (!record?.terminalId) {
      return { success: false, error: 'TERMINAL_MISSING_KEY', message: 'record must have terminalId' };
    }
    store.set(record.terminalId, { ...record });
    return { success: true };
  } catch (err) {
    return { success: false, error: 'TERMINAL_PUT_ERROR', message: err.message };
  }
}

/**
 * Retrieve a record by terminalId.
 *
 * @param {string} terminalId
 * @returns {{ record: object|null }}
 */
export async function get(terminalId) {
  try {
    return { record: store.get(terminalId) ?? null };
  } catch (err) {
    return { record: null, error: 'TERMINAL_GET_ERROR', message: err.message };
  }
}

/**
 * List records matching an optional filter.
 *
 * @param {{ blueprintKey?: string, type?: string, state?: string }} [filter]
 * @returns {{ results: object[] }}
 */
export async function list(filter = {}) {
  try {
    let results = Array.from(store.values());

    if (filter.blueprintKey) results = results.filter((r) => r.blueprintKey === filter.blueprintKey);
    if (filter.type)         results = results.filter((r) => r.type === filter.type);
    if (filter.state)        results = results.filter((r) => r.state === filter.state);

    // Most recently received first
    results.sort((a, b) => (a.receivedAt > b.receivedAt ? -1 : 1));

    return { results };
  } catch (err) {
    return { results: [], error: 'TERMINAL_LIST_ERROR', message: err.message };
  }
}

/**
 * Delete a record by terminalId.
 *
 * @param {string} terminalId
 * @returns {{ success: boolean }}
 */
export async function del(terminalId) {
  try {
    if (!store.has(terminalId)) {
      return { success: false, error: 'TERMINAL_NOT_FOUND', message: `No record for terminalId=${terminalId}` };
    }
    store.delete(terminalId);
    return { success: true };
  } catch (err) {
    return { success: false, error: 'TERMINAL_DEL_ERROR', message: err.message };
  }
}
