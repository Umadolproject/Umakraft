# Operation

Operation supervises the health of the UmaKraft pipeline.

## Components

- **Investigator** — observes `taskRegistry`, `dataSync`, `timeline`, and runtime state; produces structured investigation records
- **Logger** — formats investigation records into structured operational logs consumed by Manager
- **Manager** — evaluates logs and emits a health decision; routes Critical/Failed events to Broadcast

## Data sources

| Source | What it provides |
|---|---|
| `core/taskRegistry.js` | Per-task: `lastRunAt`, `lastSuccess`, `lastError`, `consecutiveFailures`, `totalRuns` |
| `core/health.js` | Aggregated health payload: task stats, heap/RSS memory, uptime, active circle count |
| `dataSync.js` `syncStatus` | Per-circle last sync time, consecutive sync failures, last error |
| `timeline.js` `timelineStatus` | Last update, total posted, running state, last error |
| `process.memoryUsage()` | Heap used/total, RSS |
| `process.uptime()` | Bot uptime in seconds |

## Flow

```
Pipeline / Scheduler / Runtime
        │
        ▼
Operation/Investigator      ← reads taskRegistry, syncStatus, timelineStatus, memory
        │
        ▼
Operation/Logger            ← produces structured log records
        │
        ▼
Operation/Manager           ← emits Healthy | Warning | Critical | Failed | Investigation Required
        │
        ▼
Broadcast/Announcer         ← delivers to Discord (Critical / Failed only)
        │
        ▼
Discord
```

Operation never communicates directly with Discord. Broadcast is responsible for automated delivery.
