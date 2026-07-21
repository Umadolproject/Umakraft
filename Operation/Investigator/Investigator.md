# Investigator Specification

**Department:** Operation/Investigator
**Version:** 2.0.0
**Last Updated:** 2026-07-20
**Governed By:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`

---

## Purpose

The Investigator passively observes pipeline, scheduler, and runtime state and produces structured investigation records. It never determines whether an issue is a bug — that is the Manager's responsibility.

---

## Inputs

### Scheduler events — `core/taskRegistry.js`

Each registered task exposes:

| Field | Type | Description |
|---|---|---|
| `name` | string | Task identifier (e.g. `dataSync`, `milestones`) |
| `cronExpr` | string | Cron schedule expression |
| `lastRunAt` | Date \| null | Timestamp of most recent execution |
| `lastSuccess` | boolean \| null | Whether the last run succeeded |
| `lastError` | string \| null | Error message from last failure |
| `consecutiveFailures` | number | How many runs in a row have failed |
| `totalRuns` | number | Lifetime run count |

### Pipeline events — `dataSync.syncStatus`

| Field | Description |
|---|---|
| `lastSyncAt` | Last successful sync timestamp per circle |
| `consecutiveFailures` | Consecutive sync failures per circle |
| `lastError` | Last sync error message per circle |

### Runtime state — `core/health.js` + `process`

| Field | Description |
|---|---|
| `uptime` | `process.uptime()` in seconds |
| `heapUsed` / `heapTotal` | `process.memoryUsage()` |
| `rss` | Resident set size |
| `timelineStatus` | Last update, total posted, running flag, last error |
| `activeCircles` | Count of configured active circles |

---

## Output — InvestigationRecord

```js
{
  investigatedAt: Date,         // when this record was produced
  source: string,               // 'taskRegistry' | 'dataSync' | 'timeline' | 'runtime'
  subject: string,              // task name, circle id, or component name
  consecutiveFailures: number,
  lastRunAt: Date | null,
  lastSuccess: boolean | null,
  lastError: string | null,
  staleSince: number | null,    // ms since last successful run; null if not stale
  memoryPressure: boolean,      // heapUsed / heapTotal > 0.90
  extra: Record<string, unknown> // source-specific fields
}
```

---

## Rules

- The Investigator **never** decides if something is a bug or determines severity.
- It collects facts as-is from the data sources listed above.
- One investigation record is produced per subject per evaluation cycle.
- Stale detection: `staleSince` is set when `lastRunAt` is older than 2× the expected cron interval or when `consecutiveFailures > 0`.
- Memory pressure flag is set when `heapUsed / heapTotal > 0.90`.

---

## Sample Code

```js
// Operation/Investigator/investigator.js

import { getAllTaskStats } from '../../core/taskRegistry.js';
import { getHealth } from '../../core/health.js';
import { syncStatus } from '../../fantracking/sync/dataSync.js';
import { timelineStatus } from '../../timeline/timeline.js';

/**
 * Runs one full investigation cycle.
 * Returns an array of InvestigationRecord objects — one per subject.
 *
 * @returns {InvestigationRecord[]}
 */
export async function investigate() {
  const now = new Date();
  const records = [];

  // --- taskRegistry subjects ---
  const tasks = getAllTaskStats(); // [{ name, cronExpr, lastRunAt, lastSuccess, lastError, consecutiveFailures, totalRuns }]

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
      extra: { cronExpr: task.cronExpr, totalRuns: task.totalRuns },
    });
  }

  // --- dataSync subjects ---
  const circleStatuses = syncStatus(); // { [circleId]: { lastSyncAt, consecutiveFailures, lastError } }

  for (const [circleId, status] of Object.entries(circleStatuses)) {
    records.push({
      investigatedAt: now,
      source: 'dataSync',
      subject: `circle:${circleId}`,
      consecutiveFailures: status.consecutiveFailures,
      lastRunAt: status.lastSyncAt,
      lastSuccess: status.consecutiveFailures === 0,
      lastError: status.lastError ?? null,
      staleSince: computeStaleMs(status.lastSyncAt, now),
      memoryPressure: false,
      extra: { circleId },
    });
  }

  // --- timeline subject ---
  const tl = timelineStatus();
  records.push({
    investigatedAt: now,
    source: 'timeline',
    subject: 'timeline',
    consecutiveFailures: tl.consecutiveFailures ?? 0,
    lastRunAt: tl.lastUpdate ?? null,
    lastSuccess: !tl.lastError,
    lastError: tl.lastError ?? null,
    staleSince: computeStaleMs(tl.lastUpdate, now),
    memoryPressure: false,
    extra: { totalPosted: tl.totalPosted, running: tl.running },
  });

  // --- runtime subject ---
  const health = await getHealth();
  const heapRatio = health.heapUsed / health.heapTotal;
  records.push({
    investigatedAt: now,
    source: 'runtime',
    subject: 'runtime',
    consecutiveFailures: 0,
    lastRunAt: now,
    lastSuccess: true,
    lastError: null,
    staleSince: null,
    memoryPressure: heapRatio > 0.90,
    extra: {
      heapUsed: health.heapUsed,
      heapTotal: health.heapTotal,
      rss: health.rss,
      uptime: health.uptime,
      activeCircles: health.activeCircles,
    },
  });

  return records;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function computeStaleMs(lastRunAt, now) {
  if (!lastRunAt) return null;
  const ms = now - new Date(lastRunAt);
  return ms > 0 ? ms : null;
}

function computeStaleSince(lastRunAt, cronExpr, now) {
  if (!lastRunAt) return null;
  const expectedIntervalMs = parseCronIntervalMs(cronExpr);
  const ms = now - new Date(lastRunAt);
  return ms > expectedIntervalMs * 2 ? ms : null;
}

/**
 * Very simple cron interval estimator.
 * Returns expected interval in ms based on cron expression.
 */
function parseCronIntervalMs(cronExpr) {
  if (!cronExpr) return 30 * 60 * 1000; // default 30 min
  if (cronExpr.includes('*/30')) return 30 * 60 * 1000;
  if (cronExpr.includes('*/5'))  return  5 * 60 * 1000;
  if (cronExpr.includes('*/4'))  return  4 * 60 * 60 * 1000;
  if (cronExpr.startsWith('0 ')) return  60 * 60 * 1000; // hourly
  return 30 * 60 * 1000;
}
```

---

## Related Files

- `core/taskRegistry.js` — `getTaskStats()`, `getAllTaskStats()`
- `core/health.js` — `/health` JSON payload
- `tasks/index.js` — `schedule()` wrapper that calls `recordTaskStart` / `recordTaskEnd`
- `core/errors.js` — `safeRun()`, `withRetry()` (wrap task execution, feed failure state into registry)
