# Logger Specification

The Logger consumes investigation records produced by the Investigator and formats them
into structured operational log entries. It does not evaluate severity — that is the
Manager's job.

## Input

One or more `InvestigationRecord` objects from the Investigator (see `Investigator.md`
for the full schema).

## Output — Operational Log Entry

```js
{
  timestamp: string,          // ISO-8601, same format as core/log.js output
  pipeline: string,           // top-level pipeline name: 'uma' | 'milestone' | 'timeline' | 'runtime'
  stage: string,              // subject from the investigation record (task name / circle id / component)
  status: 'ok' | 'warn' | 'error' | 'stale' | 'unknown',
  duration: number | null,    // ms between lastRunAt and investigatedAt, or null if unavailable
  consecutiveFailures: number,
  error: string | null,       // lastError from the investigation record
  meta: {
    source: string,           // investigation record source
    memoryPressure: boolean,
    staleSince: number | null // ms
  }
}
```

## Status mapping

| Condition | Status |
|---|---|
| `lastSuccess === true` and `consecutiveFailures === 0` | `ok` |
| `consecutiveFailures === 1` | `warn` |
| `consecutiveFailures >= 2` | `error` |
| `staleSince !== null` and no recent failure | `stale` |
| `lastSuccess === null` (never run) | `unknown` |

## Format conventions

Follows the same conventions as `core/log.js`:

- Timestamps are ISO-8601 UTC strings.
- Prefix format: `[YYYY-MM-DDTHH:mm:ss.sssZ] [LEVEL] [Operation/Logger] <message>`
- Log level mapping: `ok` → `info`, `warn` → `warn`, `error` / `stale` → `error`, `unknown` → `debug`

## Related files

- `core/log.js` — `log.info()`, `log.warn()`, `log.error()`, `log.debug()`
- `core/taskRegistry.js` — source of raw task stats consumed by Investigator → Logger
- `core/health.js` — mirrors a subset of what Logger tracks, useful for cross-reference
