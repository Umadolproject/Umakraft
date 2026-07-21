# Manager

**Department:** Operation/Manager
**Responsibility:** Evaluate operational logs, emit a health decision, and route escalations to Broadcast
**Version:** 2.0.0

---

## Purpose

The Manager is the decision-maker of Operation. It receives structured `OperationalLogEntry` objects from the Logger, evaluates them against defined thresholds, and emits a single `HealthDecision` per evaluation cycle.

For `Critical`, `Failed`, and `Investigation Required` decisions, the Manager hands off to `Broadcast/Announcer` for Discord delivery. `Healthy` and `Warning` decisions are logged silently with no Discord alert.

---

## Responsibilities

- Receive one or more `OperationalLogEntry` objects from the Logger
- Evaluate each entry against defined health thresholds
- Identify affected subjects and classify severity
- Emit one `HealthDecision` per evaluation cycle
- Route `Critical`, `Failed`, and `Investigation Required` to Broadcast/Announcer
- Log `Healthy` and `Warning` decisions without triggering Discord

---

## Must Not

- Call Discord directly — all delivery goes through `Broadcast/Announcer`
- Restart, repair, or modify pipeline departments
- Emit more than one health decision per evaluation cycle
- Change pipeline state or task registry data

---

## Health Decisions

| Decision | Trigger | Discord Alert |
|---|---|---|
| `Healthy` | All tasks ok, no failures, memory normal | No |
| `Warning` | 1 consecutive failure on any task, or memory pressure | No |
| `Critical` | ≥ 2 consecutive failures, or core task stale | Yes |
| `Failed` | Task has exhausted all retries (past `withRetry` max) | Yes |
| `Investigation Required` | Contradictory signals (success but data unchanged) | Yes |

---

## Core Tasks

Tasks subject to `Critical`-level stale detection:
- `dataSync` — feeds all fan-gain calculations
- `milestones` — drives milestone announcements
- Per-circle `syncStatus` entries

All other registered tasks use `Warning`-level stale detection.

---

## See Also

- `Manager.md` — full decision thresholds, routing logic, and sample code
- `../Logger/Logger.md` — log entry schema
- `GOVERNANCE/PIPELINE_REGISTRY.md` — Operation registration
