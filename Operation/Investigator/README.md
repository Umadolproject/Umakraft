# Investigator

**Department:** Operation/Investigator
**Responsibility:** Observe all pipeline data sources and produce structured investigation records
**Version:** 2.0.0

---

## Purpose

The Investigator is the eyes of Operation. It passively reads task registry state, sync status, timeline status, and runtime metrics across every pipeline stage and packages each observation into a structured `InvestigationRecord`.

The Investigator **never** decides if something is a bug or determines severity. It collects facts only. All judgment belongs to the Manager.

---

## Responsibilities

- Read `core/taskRegistry` for every registered scheduled task
- Read `dataSync.syncStatus` for per-circle sync health
- Read `timeline.timelineStatus` for timeline pipeline health
- Read `process.memoryUsage()` and `process.uptime()` for runtime state
- Produce one `InvestigationRecord` per subject per evaluation cycle
- Detect stale subjects based on expected cron intervals
- Flag memory pressure when heap usage exceeds 90%
- Forward all records to Logger

---

## Must Not

- Determine severity or classify issues
- Modify any pipeline state
- Write to any database or log
- Call Discord or Broadcast
- Make decisions about recovery

---

## See Also

- `Investigator.md` — full input/output contracts and sample code
- `../Logger/Logger.md` — how investigation records are consumed
- `GOVERNANCE/PIPELINE_REGISTRY.md` — Operation registration
