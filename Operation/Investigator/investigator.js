// Operation/Investigator/investigator.js
// The eye of Operation — passively observes pipeline, scheduler, and runtime
// state and produces structured InvestigationRecord objects.
// It never decides severity; that is the Manager's responsibility.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      Operation/Investigator/Investigator.md
// Version:   2.0.0

import { getAllTaskStats } from '../../core/taskRegistry.js';
import { getHealth } from '../../core/health.js';

// ─── Dynamic data sources ─────────────────────────────────────────────────────
// fantracking/sync/dataSync.js and timeline/timeline.js may not exist in all
// deployments. We import them dynamically and fall back to empty data gracefully.

async function getSyncStatus() {
  try {
    const mod = await import('../../fantracking/sync/dataSync.js');
    return mod.syncStatus ?? {};
  } catch {
    return {};
  }
}

async function getTimelineStatus() {
  try {
    const mod = await import('../../timeline/timeline.js');
    return mod.timelineStatus ?? null;
  } catch {
    return null;
  }
}

// ─── Stale computation ────────────────────────────────────────────────────────

/**
 * Estimate the expected cron interval in milliseconds from a cron expression.
 * Supports the subset of expressions used in this project.
 *
 * @param {string} cronExpr
 * @returns {number}  ms
 */
function parseCronIntervalMs(cronExpr) {
  if (!cronExpr) return 30 * 60 * 1000;
  if (cronExpr.includes('*/30')) return 30 * 60 * 1000;
  if (cronExpr.includes('*/5'))  return  5 * 60 * 1000;
  if (cronExpr.includes('*/4'))  return  4 * 60 * 60 * 1000;
  if (cronExpr.startsWith('0 ')) return 60 * 60 * 1000;
  return 30 * 60 * 1000;
}

/**
 * Returns ms since lastRunAt if it exceeds 2× the expected cron interval, else null.
 * Null means: not stale (or no run recorded yet).
 *
 * @param {Date|null} lastRunAt
 * @param {string}    cronExpr
 * @param {Date}      now
 * @returns {number|null}
 */
function computeStaleSince(lastRunAt, cronExpr, now) {
  if (!lastRunAt) return null;
  const expectedIntervalMs = parseCronIntervalMs(cronExpr);
  const ms = now - new Date(lastRunAt);
  return ms > expectedIntervalMs * 2 ? ms : null;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Runs one full investigation cycle.
 * Collects facts from all four data sources and returns one InvestigationRecord
 * per subject. No severity decisions are made here.
 *
 * @returns {Promise<InvestigationRecord[]>}
 *
 * @typedef {Object} InvestigationRecord
 * @property {Date}            investigatedAt
 * @property {string}          source              — 'taskRegistry' | 'dataSync' | 'timeline' | 'runtime'
 * @property {string}          subject             — task name, circle id, or component name
 * @property {number}          consecutiveFailures
 * @property {Date|null}       lastRunAt
 * @property {boolean|null}    lastSuccess
 * @property {string|null}     lastError
 * @property {number|null}     staleSince          — ms since last successful run; null if not stale
 * @property {boolean}         memoryPressure      — heapUsed / heapTotal > 0.90
 * @property {Record<string, unknown>} extra       — source-specific fields
 */
export async function investigate() {
  const now    = new Date();
  const health = getHealth();
  const records = [];

  // Compute global memory pressure once — applied to the runtime record only
  const memoryPressure = health.heapTotal > 0
    ? (health.heapUsed / health.heapTotal) > 0.90
    : false;

  // ── taskRegistry subjects ─────────────────────────────────────────────────
  const tasks = getAllTaskStats();
  for (const task of tasks) {
    const staleSince = computeStaleSince(task.lastRunAt, task.cronExpr, now);
    records.push({
      investigatedAt: now,
      source: 'taskRegistry',
      subject: task.name,
      consecutiveFailures: task.consecutiveFailures,
      lastRunAt: task.lastRunAt,
      lastSuccess: task.lastSuccess,
      lastError: task.lastError ?? null,
      staleSince,
      memoryPressure: false,
      extra: {
        cronExpr: task.cronExpr,
        totalRuns: task.totalRuns,
      },
    });
  }

  // ── dataSync subjects (per-circle sync state) ─────────────────────────────
  const syncStatus = await getSyncStatus();
  for (const [circleId, status] of Object.entries(syncStatus)) {
    const lastRunAt   = status.lastSyncAt ? new Date(status.lastSyncAt) : null;
    const failures    = status.consecutiveFailures ?? 0;
    const lastSuccess = lastRunAt !== null ? (failures === 0 ? true : false) : null;
    records.push({
      investigatedAt: now,
      source: 'dataSync',
      subject: circleId,
      consecutiveFailures: failures,
      lastRunAt,
      lastSuccess,
      lastError: status.lastError ?? null,
      staleSince: null, // no cronExpr available per-circle; Manager evaluates via entry status
      memoryPressure: false,
      extra: {},
    });
  }

  // ── timeline subject ──────────────────────────────────────────────────────
  const timelineStatus = await getTimelineStatus();
  if (timelineStatus !== null) {
    const lastRunAt = timelineStatus.lastUpdate ? new Date(timelineStatus.lastUpdate) : null;
    records.push({
      investigatedAt: now,
      source: 'timeline',
      subject: 'timeline',
      consecutiveFailures: 0,
      lastRunAt,
      lastSuccess: timelineStatus.running === true ? true : null,
      lastError: timelineStatus.lastError ?? null,
      staleSince: null,
      memoryPressure: false,
      extra: {
        totalPosted: timelineStatus.totalPosted ?? null,
        running: timelineStatus.running ?? null,
      },
    });
  }

  // ── runtime subject ───────────────────────────────────────────────────────
  records.push({
    investigatedAt: now,
    source: 'runtime',
    subject: 'runtime',
    consecutiveFailures: 0,
    lastRunAt: null,
    lastSuccess: true,
    lastError: null,
    staleSince: null,
    memoryPressure,
    extra: {
      uptime:    health.uptime,
      heapUsed:  health.heapUsed,
      heapTotal: health.heapTotal,
      rss:       health.rss,
    },
  });

  return records;
}
