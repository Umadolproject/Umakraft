// core/pipelineMetrics.js
// Lightweight in-process stage-level throughput counters.
// Phase 4: tracks runs, failures, and average duration per pipeline stage.
// These reset on process restart — they are observability helpers, not durable records.

const _metrics = new Map(); // stage -> { runs, failures, totalMs }

/**
 * Record one stage execution.
 * @param {string} stage
 * @param {number} durationMs
 * @param {boolean} failed
 */
export function recordStageRun(stage, durationMs, failed = false) {
  const m = _metrics.get(stage) ?? { runs: 0, failures: 0, totalMs: 0 };
  m.runs++;
  if (failed) m.failures++;
  m.totalMs += durationMs;
  _metrics.set(stage, m);
}

/**
 * Return a snapshot of all stage metrics.
 * @returns {Record<string, { runs: number, failures: number, avgMs: number }>}
 */
export function getMetrics() {
  const result = {};
  for (const [stage, m] of _metrics) {
    result[stage] = {
      runs: m.runs,
      failures: m.failures,
      avgMs: m.runs > 0 ? Math.round(m.totalMs / m.runs) : 0,
    };
  }
  return result;
}

/** Reset all counters (primarily for tests). */
export function resetMetrics() {
  _metrics.clear();
}
