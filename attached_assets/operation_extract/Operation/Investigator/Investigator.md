# Investigator Specification

The Investigator passively observes pipeline, scheduler, and runtime state and produces
structured investigation records. It never determines whether an issue is a bug — that
is the Manager's responsibility.

## Inputs

### Scheduler events (from `core/taskRegistry.js`)

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

### Pipeline events (from `dataSync.js` `syncStatus`)

| Field | Description |
|---|---|
| `lastSyncAt` | Last successful sync timestamp per circle |
| `consecutiveFailures` | Consecutive sync failures per circle |
| `lastError` | Last sync error message per circle |

### Runtime state (from `core/health.js` + `process`)

| Field | Description |
|---|---|
| `uptime` | `process.uptime()` in seconds |
| `heapUsed` / `heapTotal` | `process.memoryUsage()` |
| `rss` | Resident set size |
| `timelineStatus` | Last timeline update, total posted, running flag, last error |
| `activeCircles` | Count of configured active circles |

## Output — Investigation Record

```js
{
  investigatedAt: Date,        // when this record was produced
  source: string,              // 'taskRegistry' | 'dataSync' | 'timeline' | 'runtime'
  subject: string,             // task name, circle id, or component name
  consecutiveFailures: number,
  lastRunAt: Date | null,
  lastSuccess: boolean | null,
  lastError: string | null,
  staleSince: number | null,   // ms since last successful run, null if never stale
  memoryPressure: boolean,     // heapUsed / heapTotal > 0.90
  extra: Record<string, unknown>  // source-specific fields
}
```

## Rules

- The Investigator **never** decides if something is a bug or determines severity.
- It collects facts as-is from the data sources listed above.
- One investigation record is produced per subject per evaluation cycle.
- Stale detection: `staleSince` is set when `lastRunAt` is older than 2× the expected
  cron interval or when `consecutiveFailures > 0`.
- Memory pressure flag is set when `heapUsed / heapTotal > 0.90`.

## Related files

- `core/taskRegistry.js` — `getTaskStats()`, `getAllTaskStats()`
- `core/health.js` — `/health` JSON payload
- `tasks/index.js` — `schedule()` wrapper that calls `recordTaskStart` / `recordTaskEnd`
- `core/errors.js` — `safeRun()`, `withRetry()` (wrap task execution, feed failure state into registry)
