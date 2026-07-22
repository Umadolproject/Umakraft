// core/taskRegistry.js
// In-memory task registry — tracks per-task execution state.
// Read by Operation/Investigator to observe scheduler health.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      Operation/Investigator/Investigator.md

/**
 * @typedef {Object} TaskStats
 * @property {string}        name
 * @property {string}        cronExpr
 * @property {Date|null}     lastRunAt
 * @property {boolean|null}  lastSuccess
 * @property {string|null}   lastError
 * @property {number}        consecutiveFailures
 * @property {number}        totalRuns
 */

/** @type {Map<string, TaskStats>} */
const _registry = new Map();

/**
 * Register a task. Called by tasks/index.js during schedule().
 * Safe to call multiple times — subsequent calls for the same name are no-ops.
 *
 * @param {string} name      — unique task identifier
 * @param {string} cronExpr  — cron schedule expression
 */
export function registerTask(name, cronExpr) {
  if (_registry.has(name)) return;
  _registry.set(name, {
    name,
    cronExpr,
    lastRunAt: null,
    lastSuccess: null,
    lastError: null,
    consecutiveFailures: 0,
    totalRuns: 0,
  });
}

/**
 * Called when a task begins execution.
 * Updates lastRunAt so staleness detection works correctly.
 *
 * @param {string} name
 */
export function recordTaskStart(name) {
  const stats = _registry.get(name);
  if (!stats) return;
  stats.lastRunAt = new Date();
}

/**
 * Called when a task finishes execution (success or failure).
 * Updates lastSuccess, lastError, consecutiveFailures, and totalRuns.
 *
 * @param {string} name
 * @param {{ success: boolean, error?: string|null }} result
 */
export function recordTaskEnd(name, { success, error = null } = {}) {
  const stats = _registry.get(name);
  if (!stats) return;
  stats.lastSuccess = success;
  stats.lastError   = error ?? null;
  stats.totalRuns  += 1;
  if (success) {
    stats.consecutiveFailures = 0;
  } else {
    stats.consecutiveFailures += 1;
  }
}

/**
 * Return stats for a single registered task, or null if not found.
 *
 * @param {string} name
 * @returns {TaskStats|null}
 */
export function getTaskStats(name) {
  return _registry.get(name) ?? null;
}

/**
 * Return stats for all registered tasks.
 *
 * @returns {TaskStats[]}
 */
export function getAllTaskStats() {
  return Array.from(_registry.values());
}
