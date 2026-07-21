# Warning Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the warning / alert deliverable.

It describes how a standardized warning card is rendered for abnormal conditions — including API failures, fan gain anomalies, quota limits, and data integrity issues.

---

## Product Overview

The warning card is an alert-style image card or Discord embed delivered automatically by the Broadcast pipeline when the warning engine detects an abnormal condition. It is not triggered by a slash command — it is a Broadcast-initiated deliverable.

---

## Trigger

Broadcast pipeline (Broker → Broadcast Inspector → Announcer)

Not a slash command. Triggered automatically by the warning engine.

---

## Inputs

| Field | Type | Description |
|-------|------|-------------|
| `severity` | String | `info`, `warning`, or `critical` |
| `context` | Object | Structured context describing the condition |

---

## Severity Levels

| Level | Usage | Color |
|-------|-------|-------|
| `info` | Informational notice; no action required | `#8A7CF7` (Secondary) |
| `warning` | Abnormal condition; review recommended | `#FFD54F` (Gold) |
| `critical` | Serious issue; immediate attention required | `#FF5AA5` (Primary) |

---

## Layout

1. Header
   - Severity badge (INFO / WARNING / CRITICAL)
   - Alert title
   - Timestamp
2. Condition block
   - Error code
   - Human-readable description
   - Affected trainer / circle (if applicable)
3. Detail panel
   - Context fields (key–value pairs from context object)
   - Remediation steps (if available)
4. Footer
   - Source attribution and monitoring channel tag

---

## Data Contract

The blueprint expects:

- `meta`
  - `severity` — `info` | `warning` | `critical`
  - `errorCode` — string identifier, e.g. `FAN_GAIN_ANOMALY`
  - `generatedAt`
  - `targetId` (optional)
  - `targetName` (optional)
- `alert`
  - `title` — short alert title
  - `description` — human-readable explanation
  - `context` — array of `{ label, value }` key–value pairs
  - `remediation` — array of strings describing suggested actions (may be empty)

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 2 — Refinery | Refiner | Detect anomalies, compute warning conditions |
| 2 — Refinery | Compiler | Assemble compiled warning product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render warning card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 5 — Broadcast | Broker | Trigger warning notification job |
| 5 — Broadcast | Broadcast Inspector | Approve notification, deduplicate, resolve recipients |
| 5 — Broadcast | Archive | Store approved notification record |
| 5 — Broadcast | Announcer | Deliver warning card to monitoring channel |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Duplicate warning (same error code, same target, within window) | Broadcast Inspector deduplicates — card not rendered |
| Unknown severity level | Default to `warning`; log classification error |
| Empty context | Render card without context panel; do not fail |

---

## Performance Requirements

- Warning cards rendered within 2 seconds of Announcer trigger.
- `critical` severity cards bypass deduplication windows.
- `info` and `warning` severity deduplicated within a configurable time window.

---

## Workflow

```text
Warning condition detected (Refinery warning engine)
      │
      ▼
Broker — create warning notification job
      │
      ▼
Broadcast Inspector — eligibility check, deduplication, recipient resolution
      │
      ▼
Archive — store approved notification record
      │
      ▼
Announcer — trigger Workshop/Fabricator to render warning card
      │
      ▼
Workshop — Fabricator renders card using this blueprint
      │
      ▼
Announcer — deliver card to monitoring channel
```

---

## Implementation Notes

- Integrates with `umamoe/ERROR_HANDLING.md` error code classifications.
- Warning engine logic (`fantracking/warnings/`) is pending assimilation into the Refinery (per `PIPELINE_REGISTRY.md`).
- Daily, weekly, and monthly warning variants use the same blueprint with different context payloads.
- `critical` alerts should also be logged to a dedicated monitoring channel separate from general announcements.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
