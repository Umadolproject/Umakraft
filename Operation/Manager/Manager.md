# Manager Specification

**Department:** Operation/Manager
**Version:** 2.0.0
**Last Updated:** 2026-07-22
**Governed By:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`

---

## Purpose

The Manager receives structured operational log entries from the Logger, evaluates them against defined thresholds, and emits a health decision. For `Critical`, `Failed`, and `Investigation Required` states it hands off to `Broadcast/Announcer` for Discord delivery.

---

## Input

One or more `OperationalLogEntry` objects from the Logger. See `Logger/Logger.md` for the full schema.

---

## Health Decisions

| Decision | Meaning |
|---|---|
| `Healthy` | All tasks running on schedule, no failures, memory normal |
| `Warning` | One task has 1 consecutive failure, or memory pressure detected |
| `Critical` | Any task has ≥ 2 consecutive failures, or a core pipeline task is stale |
| `Failed` | A task has thrown unrecoverable errors past `withRetry` exhaustion |
| `Investigation Required` | Contradictory signals (e.g. task reports success but data is stale) |

---

## Decision Thresholds

| Signal | Threshold | Decision |
|---|---|---|
| `consecutiveFailures` | 1 | Warning |
| `consecutiveFailures` | ≥ 2 | Critical |
| `consecutiveFailures` past `withRetry` max (default 3) | — | Failed |
| `memoryPressure` | `heapUsed / heapTotal > 0.90` | Warning |
| `staleSince` on a core task (`dataSync`, `milestones`) | > 2× cron interval | Critical |
| `staleSince` on a non-core task | > 2× cron interval | Warning |
| `lastSuccess === true` but downstream data unchanged | — | Investigation Required |

---

## Core Tasks

Tasks subject to `Critical`-level stale detection:
- `dataSync` — feeds all fan-gain calculations
- `milestones` — drives milestone announcements
- Per-circle sync entries from `syncStatus`

All other registered tasks default to `Warning`-level stale detection.

---

## Output — HealthDecision

```js
{
  decidedAt: Date,
  decision: 'Healthy' | 'Warning' | 'Critical' | 'Failed' | 'Investigation Required',
  affectedSubjects: string[],    // task names / circle ids that triggered the decision
  summary: string,               // human-readable one-line summary for Discord
  logEntries: OperationalLogEntry[]  // the Logger entries that led to this decision
}
```

---

## Routing

| Decision | Action |
|---|---|
| `Healthy` | `log.info` only — no Discord notification |
| `Warning` | `log.warn` only — no Discord notification |
| `Critical` | `log.error` + hand off to `Broadcast/Announcer` |
| `Failed` | `log.error` + hand off to `Broadcast/Announcer` |
| `Investigation Required` | `log.warn` + hand off to `Broadcast/Announcer` |

---

## Recovery Integration

- `safeRun(fn, context)` — used by scheduled tasks to swallow non-fatal errors; a swallowed error increments `consecutiveFailures` in `taskRegistry`, which the Investigator picks up next cycle.
- `withRetry(fn, opts)` — linear backoff retries before a task is marked `Failed`. Once all retries are exhausted the error propagates and `consecutiveFailures` reaches the `Failed` threshold.

---

## Sample Code

```js
// Operation/Manager/manager.js

import log from '../../core/log.js';

const CORE_TASKS = new Set(['dataSync', 'milestones']);
const WITHRETRY_MAX = 3;

/**
 * Evaluates a set of OperationalLogEntries and emits one HealthDecision.
 *
 * @param {OperationalLogEntry[]} entries
 * @returns {HealthDecision}
 */
export function evaluate(entries) {
  const decidedAt = new Date();
  let decision = 'Healthy';
  const affectedSubjects = [];
  const reasons = [];

  for (const entry of entries) {
    const { stage, consecutiveFailures, status, meta } = entry;

    // Failed — past withRetry max
    if (consecutiveFailures > WITHRETRY_MAX) {
      escalate('Failed', stage, `${stage} has exhausted all retries (${consecutiveFailures} consecutive failures)`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Failed');
      continue;
    }

    // Critical — ≥ 2 failures
    if (consecutiveFailures >= 2) {
      escalate('Critical', stage, `${stage} has ${consecutiveFailures} consecutive failures`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Critical');
      continue;
    }

    // Critical — core task stale
    if (status === 'stale' && CORE_TASKS.has(stage)) {
      escalate('Critical', stage, `Core task ${stage} is stale for ${meta.staleSince}ms`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Critical');
      continue;
    }

    // Warning — 1 failure
    if (consecutiveFailures === 1) {
      escalate('Warning', stage, `${stage} has 1 consecutive failure`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Warning');
      continue;
    }

    // Warning — non-core task stale
    if (status === 'stale') {
      escalate('Warning', stage, `${stage} is stale for ${meta.staleSince}ms`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Warning');
      continue;
    }

    // Warning — memory pressure
    if (meta.memoryPressure) {
      escalate('Warning', stage, `Memory pressure detected at ${stage}`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Warning');
      continue;
    }

    // Investigation Required — contradictory signals
    if (entry.status === 'ok' && meta.staleSince !== null) {
      escalate('Investigation Required', stage, `${stage} reports success but data appears stale`, affectedSubjects, reasons);
      decision = rankDecision(decision, 'Investigation Required');
    }
  }

  const summary = reasons.length > 0
    ? reasons.join('; ')
    : 'All pipeline stages healthy.';

  const result = { decidedAt, decision, affectedSubjects, summary, logEntries: entries };

  // Route based on decision
  route(result);

  return result;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function escalate(level, subject, reason, affectedSubjects, reasons) {
  if (!affectedSubjects.includes(subject)) affectedSubjects.push(subject);
  reasons.push(reason);
}

/**
 * Returns the higher-severity decision of the two.
 */
function rankDecision(current, incoming) {
  const rank = { 'Healthy': 0, 'Warning': 1, 'Investigation Required': 2, 'Critical': 3, 'Failed': 4 };
  return rank[incoming] > rank[current] ? incoming : current;
}

/**
 * Routes the health decision to log or Broadcast.
 */
async function route(result) {
  const { decision, summary, affectedSubjects } = result;

  switch (decision) {
    case 'Healthy':
      log.info(`[Operation/Manager] decision=Healthy — ${summary}`);
      break;

    case 'Warning':
      log.warn(`[Operation/Manager] decision=Warning subjects=[${affectedSubjects.join(', ')}] — ${summary}`);
      break;

    case 'Critical':
      log.error(`[Operation/Manager] decision=Critical subjects=[${affectedSubjects.join(', ')}] — ${summary}`);
      await handOffToBroadcast(result);
      break;

    case 'Failed':
      log.error(`[Operation/Manager] decision=Failed subjects=[${affectedSubjects.join(', ')}] — ${summary}`);
      await handOffToBroadcast(result);
      break;

    case 'Investigation Required':
      log.warn(`[Operation/Manager] decision=InvestigationRequired subjects=[${affectedSubjects.join(', ')}] — ${summary}`);
      await handOffToBroadcast(result);
      break;
  }
}

/**
 * Hands the health decision off to Broadcast/Announcer.
 * Operation never calls Discord directly.
 */
async function handOffToBroadcast(result) {
  // Import dynamically to keep Operation decoupled from Broadcast at module load time
  const { announceOperationAlert } = await import('../../Broadcast/Announcer/announcer.js');
  await announceOperationAlert({
    decision: result.decision,
    summary: result.summary,
    affectedSubjects: result.affectedSubjects,
    decidedAt: result.decidedAt,
  });
}
```

---

## Full Operation Cycle — Entry Point

```js
// Operation/operation.js
// Wired into tasks/index.js as a scheduled cron task.

import { investigate } from './Investigator/investigator.js';
import { formatLogs }  from './Logger/logger.js';
import { evaluate }    from './Manager/manager.js';
import log             from '../core/log.js';

/**
 * Runs one complete Operation evaluation cycle:
 *   Investigator → Logger → Manager
 *
 * Called by the task scheduler every 5 minutes.
 */
export async function runOperationCycle() {
  log.info('[Operation] Evaluation cycle started.');

  try {
    const records = await investigate();    // Investigator
    const entries = formatLogs(records);    // Logger
    const decision = evaluate(entries);     // Manager

    log.info(`[Operation] Cycle complete. decision=${decision.decision} subjects=[${decision.affectedSubjects.join(', ') || 'none'}]`);
    return decision;
  } catch (err) {
    log.error(`[Operation] Cycle failed with uncaught error: ${err.message}`);
  }
}
```

---

## Related Files

- `core/taskRegistry.js` — `getTaskStats()` / `getAllTaskStats()` / `recordTaskEnd()`
- `core/errors.js` — `safeRun()`, `withRetry()`
- `tasks/index.js` — `schedule()` wrapper; registers `runOperationCycle` on cron
- `Broadcast/Announcer/announcer.js` — `announceOperationAlert()` — delivery target for Critical/Failed/Investigation Required

---

## Version History

- `v1.0` — Initial Manager specification; five health decisions; `HealthDecision` schema;
  routing to `Broadcast/Announcer` via `announceOperationAlert()`; full `operation.js`
  cycle entry point documented
- `v2.0` — Stable specification; no functional changes from v1.0; marks Manager as
  ready for implementation
