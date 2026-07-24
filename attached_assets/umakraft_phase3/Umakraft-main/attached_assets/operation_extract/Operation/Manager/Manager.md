# Manager Specification

The Manager receives structured operational log entries from the Logger, evaluates them
against defined thresholds, and emits a health decision. For Critical and Failed states
it hands off to `Broadcast/Announcer` for Discord delivery.

## Input

One or more operational log entries from the Logger (see `Logger.md` for the schema).

## Decisions

| Decision | Meaning |
|---|---|
| `Healthy` | All tasks running on schedule, no failures, memory normal |
| `Warning` | One task has 1 consecutive failure, or memory pressure detected |
| `Critical` | Any task has ≥ 2 consecutive failures, or a core pipeline is stale |
| `Failed` | A task has thrown unrecoverable errors past `withRetry` exhaustion |
| `Investigation Required` | Contradictory signals (e.g. task reports success but data is stale) |

## Decision thresholds

| Signal | Threshold | Decision |
|---|---|---|
| `consecutiveFailures` | 1 | Warning |
| `consecutiveFailures` | ≥ 2 | Critical |
| `consecutiveFailures` past `withRetry` max (default 3) | — | Failed |
| `memoryPressure` | `heapUsed / heapTotal > 0.90` | Warning |
| `staleSince` on a core task (`dataSync`, `milestones`) | > 2× cron interval | Critical |
| `staleSince` on a non-core task | > 2× cron interval | Warning |
| `lastSuccess === true` but downstream data unchanged | — | Investigation Required |

## Core tasks

Tasks considered core (Critical-level stale detection):

- `dataSync` — feeds all fan-gain calculations
- `milestones` — drives milestone announcements
- `dataSync` per active circle via `syncStatus`

Non-core tasks (Warning-level stale detection): all others registered in `taskRegistry`.

## Output

```js
{
  decidedAt: Date,
  decision: 'Healthy' | 'Warning' | 'Critical' | 'Failed' | 'Investigation Required',
  affectedSubjects: string[],   // task names / circle ids that triggered the decision
  summary: string,              // human-readable one-line summary for Discord
  logEntries: OperationalLogEntry[]  // the Logger entries that led to this decision
}
```

## Routing

| Decision | Action |
|---|---|
| `Healthy` | Log only (`log.info`) — no Discord notification |
| `Warning` | Log only (`log.warn`) — no Discord notification |
| `Critical` | Log + hand off to `Broadcast/Announcer` |
| `Failed` | Log + hand off to `Broadcast/Announcer` |
| `Investigation Required` | Log + hand off to `Broadcast/Announcer` |

## Recovery — integration with `core/errors.js`

- `safeRun(fn, context)` — used by scheduled tasks to swallow non-fatal errors; a swallowed
  error increments `consecutiveFailures` in `taskRegistry`, which the Investigator picks up.
- `withRetry(fn, opts)` — linear backoff retries before a task is marked Failed. Once all
  retries are exhausted the error propagates and `consecutiveFailures` reaches the Failed
  threshold.

## Related files

- `core/taskRegistry.js` — `getTaskStats()` / `getAllTaskStats()` / `recordTaskEnd()`
- `core/errors.js` — `safeRun()`, `withRetry()`
- `tasks/index.js` — `schedule()` wrapper; wraps every task in try/catch/finally and
  calls `recordTaskStart` / `recordTaskEnd`
- `Broadcast/Announcer/milestoneAnnouncer.js` — delivery target for Critical/Failed/Investigation Required
