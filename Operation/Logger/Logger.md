# Logger Specification

**Department:** Operation/Logger
**Version:** 2.0.0
**Last Updated:** 2026-07-22
**Governed By:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`

---

## Purpose

The Logger consumes `InvestigationRecord` objects produced by the Investigator and formats them into structured `OperationalLogEntry` objects. It does not evaluate severity — that is the Manager's job.

---

## Input

One or more `InvestigationRecord` objects from the Investigator. See `Investigator/Investigator.md` for the full schema.

---

## Output — OperationalLogEntry

```js
{
  timestamp: string,           // ISO-8601 UTC
  pipeline: string,            // 'uma' | 'milestone' | 'timeline' | 'runtime' | 'dataSync'
  stage: string,               // subject from the investigation record
  status: 'ok' | 'warn' | 'error' | 'stale' | 'unknown',
  duration: number | null,     // ms between lastRunAt and investigatedAt, or null
  consecutiveFailures: number,
  error: string | null,        // lastError from the investigation record
  meta: {
    source: string,            // investigation record source
    memoryPressure: boolean,
    staleSince: number | null  // ms
  }
}
```

---

## Status Mapping

| Condition | Status | Log Level |
|---|---|---|
| `lastSuccess === true` and `consecutiveFailures === 0` | `ok` | `info` |
| `consecutiveFailures === 1` | `warn` | `warn` |
| `consecutiveFailures >= 2` | `error` | `error` |
| `staleSince !== null` and no recent failure | `stale` | `error` |
| `lastSuccess === null` (never run) | `unknown` | `debug` |
| `memoryPressure === true` | adds to existing status | `warn` |

---

## Format Conventions

Follows the same conventions as `core/log.js`:

- Timestamps are ISO-8601 UTC strings.
- Prefix format: `[YYYY-MM-DDTHH:mm:ss.sssZ] [LEVEL] [Operation/Logger] <message>`
- Log level mapping: `ok` → `info`, `warn` → `warn`, `error` / `stale` → `error`, `unknown` → `debug`

---

## Pipeline Mapping

| Source | Pipeline Label |
|---|---|
| `taskRegistry` — `dataSync` task | `uma` |
| `taskRegistry` — `milestones` task | `milestone` |
| `taskRegistry` — `timelineScheduler` task | `timeline` |
| `dataSync` | `dataSync` |
| `timeline` | `timeline` |
| `runtime` | `runtime` |
| all others | `core` |

---

## Sample Code

```js
// Operation/Logger/logger.js

import log from '../../core/log.js';

/**
 * Formats an array of InvestigationRecords into OperationalLogEntry objects.
 * Emits each entry to core/log.js at the appropriate level.
 *
 * @param {InvestigationRecord[]} records
 * @returns {OperationalLogEntry[]}
 */
export function formatLogs(records) {
  return records.map(record => formatOne(record));
}

function formatOne(record) {
  const status = resolveStatus(record);
  const duration = computeDuration(record.lastRunAt, record.investigatedAt);
  const pipeline = resolvePipeline(record.source, record.subject);

  const entry = {
    timestamp: record.investigatedAt.toISOString(),
    pipeline,
    stage: record.subject,
    status,
    duration,
    consecutiveFailures: record.consecutiveFailures,
    error: record.lastError ?? null,
    meta: {
      source: record.source,
      memoryPressure: record.memoryPressure,
      staleSince: record.staleSince ?? null,
    },
  };

  // Emit to core/log.js
  const message = buildMessage(entry);
  switch (status) {
    case 'ok':      log.info(`[Operation/Logger] ${message}`);  break;
    case 'warn':    log.warn(`[Operation/Logger] ${message}`);  break;
    case 'error':
    case 'stale':   log.error(`[Operation/Logger] ${message}`); break;
    case 'unknown': log.debug(`[Operation/Logger] ${message}`); break;
  }

  if (record.memoryPressure) {
    log.warn(`[Operation/Logger] Memory pressure detected — stage=${entry.stage} heap=${record.extra?.heapUsed}/${record.extra?.heapTotal}`);
  }

  return entry;
}

// ─── helpers ───────────────────────────────────────────────────────────────

function resolveStatus(record) {
  if (record.lastSuccess === null) return 'unknown';
  if (record.consecutiveFailures >= 2) return 'error';
  if (record.consecutiveFailures === 1) return 'warn';
  if (record.staleSince !== null && record.consecutiveFailures === 0) return 'stale';
  return 'ok';
}

function computeDuration(lastRunAt, investigatedAt) {
  if (!lastRunAt) return null;
  return investigatedAt - new Date(lastRunAt);
}

function resolvePipeline(source, subject) {
  if (source === 'runtime') return 'runtime';
  if (source === 'timeline') return 'timeline';
  if (source === 'dataSync') return 'dataSync';
  if (subject === 'dataSync') return 'uma';
  if (subject === 'milestones') return 'milestone';
  if (subject?.startsWith('timeline')) return 'timeline';
  return 'core';
}

function buildMessage(entry) {
  return `pipeline=${entry.pipeline} stage=${entry.stage} status=${entry.status} failures=${entry.consecutiveFailures} duration=${entry.duration ?? 'n/a'}ms${entry.error ? ` error="${entry.error}"` : ''}`;
}
```

---

## Related Files

- `core/log.js` — `log.info()`, `log.warn()`, `log.error()`, `log.debug()`
- `core/taskRegistry.js` — source of raw task stats consumed by Investigator → Logger
- `core/health.js` — mirrors a subset of what Logger tracks

---

## Version History

- `v1.0` — Initial Logger specification; five status codes: `ok`, `warn`, `error`,
  `stale`, `unknown`; pipeline label mapping; `OperationalLogEntry` schema
- `v2.0` — Stable specification; no functional changes from v1.0; marks Logger as
  ready for implementation
