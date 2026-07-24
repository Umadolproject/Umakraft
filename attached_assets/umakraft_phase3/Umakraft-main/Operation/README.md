# Operation

**Status:** Official Independent Pipeline Supervisor
**Authority:** Governed by `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Version:** 2.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Operation is the **independent health supervisor** of the UmaKraft pipeline.

It runs on its own schedule, parallel to the main pipeline, and is responsible for one thing only: **knowing whether the pipeline is healthy and acting on it when it is not.**

Operation does not process fan data, render cards, handle commands, or deliver notifications. It watches everything and speaks only when something is wrong.

---

## Position in the Architecture

Operation sits **outside and above** the main pipeline. It observes all five stages from the outside and feeds its decisions exclusively into Broadcast when escalation is needed.

```text
┌─────────────────────────────────────────────────────────────┐
│                      MAIN PIPELINE                          │
│                                                             │
│   Umamoe → Refinery → Workshop → Distribution → Broadcast  │
│                                                             │
└──────┬──────────┬────────────┬──────────────┬──────────────┘
       │          │            │              │
       └──────────┴────────────┴──────────────┘
                               │
                    reads task stats, sync state,
                    memory, timeline, runtime
                               │
                               ▼
              ┌────────────────────────────────┐
              │           OPERATION            │
              │   (independent supervisor)     │
              │                                │
              │   Investigator                 │
              │        │                       │
              │        ▼                       │
              │   Logger                       │
              │        │                       │
              │        ▼                       │
              │   Manager                      │
              └────────────────────────────────┘
                               │
                  Critical / Failed / Investigation Required
                               │
                               ▼
                      Broadcast / Announcer
                               │
                               ▼
                            Discord
```

---

## Internal Pipeline

```text
Pipeline / Scheduler / Runtime
        │
        ▼
Operation/Investigator   ← observes taskRegistry, syncStatus, timelineStatus, memory
        │
        ▼
Operation/Logger         ← formats investigation records into structured log entries
        │
        ▼
Operation/Manager        ← evaluates logs, emits health decision, routes to Broadcast
        │
        ▼
Broadcast/Announcer      ← delivers Critical/Failed alerts to Discord
        │
        ▼
Discord
```

---

## Entry Point

`operation.js` — exports `runOperationCycle()`, wired into `tasks/index.js` on a 5-minute cron schedule. Runs the full Investigator → Logger → Manager chain in sequence.

---

## Departments

| Department | File | Responsibility |
|---|---|---|
| Investigator | `Investigator/investigator.js` | Observes all pipeline data sources and produces investigation records |
| Logger | `Logger/logger.js` | Formats investigation records into structured operational log entries |
| Manager | `Manager/manager.js` | Evaluates logs, emits health decision, hands off to Broadcast on escalation |

---

## Data Sources Observed

| Source | What Operation reads |
|---|---|
| `core/taskRegistry` | Per-task: `lastRunAt`, `lastSuccess`, `lastError`, `consecutiveFailures`, `totalRuns` |
| `core/health.js` | Aggregated health: task stats, heap/RSS memory, uptime, active circle count |
| `dataSync.syncStatus` | Per-circle: last sync time, consecutive sync failures, last error |
| `timeline.timelineStatus` | Last update, total posted, running state, last error |
| `process.memoryUsage()` | Heap used/total, RSS |
| `process.uptime()` | Bot uptime in seconds |

---

## Health Decisions

| Decision | Meaning | Discord Alert |
|---|---|---|
| `Healthy` | All tasks running, no failures, memory normal | No |
| `Warning` | One task has 1 failure, or memory pressure | No |
| `Critical` | Any task has ≥ 2 failures, or core pipeline stale | Yes |
| `Failed` | Task has exhausted all retries | Yes |
| `Investigation Required` | Contradictory signals (success but data stale) | Yes |

---

## Core Rules

- Operation **never** calls Discord directly. All alerts go through `Broadcast/Announcer`.
- Operation **never** modifies pipeline state. It is read-only except for its own logs.
- Operation **never** restarts or repairs pipeline departments. It reports; it does not fix.
- One health decision is emitted per evaluation cycle.
- Healthy and Warning decisions are silent — logged only.
- Only Critical, Failed, and Investigation Required trigger a Discord alert.

---

## Reading Order

1. `README.md` — this file
2. `Investigator/Investigator.md` — observation contracts and sample code
3. `Logger/Logger.md` — log format, status mapping, and sample code
4. `Manager/Manager.md` — decision thresholds, routing, and sample code

---

## Version History

- `v1.0` — Initial Operation specification; Investigator → Logger → Manager internal pipeline
- `v2.0` — Entry point `operation.js` / `runOperationCycle()` formally documented; all
  department specs aligned and dated; `Last Updated` corrected to 2026-07-22
