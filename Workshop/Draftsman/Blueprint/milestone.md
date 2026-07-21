# Milestone Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the milestone notification deliverable.

It describes how a milestone achievement card is rendered when a trainer or circle crosses a significant threshold — fan count, rank, or other tracked achievement.

---

## Product Overview

The milestone card is a celebratory image card sent automatically by the Broadcast pipeline when a threshold crossing is detected. It is not triggered by a slash command — it is a Broadcast-initiated deliverable that uses this blueprint for rendering.

---

## Trigger

Broadcast pipeline (Broker → Broadcast Inspector → Announcer)

Not a slash command. Triggered automatically by threshold detection.

---

## Inputs

| Field | Type | Description |
|-------|------|-------------|
| `target_id` | String | Trainer ID or circle ID |
| `target_type` | String | `trainer` or `circle` |
| `milestone_type` | String | `fans` or `rank` |
| `threshold_value` | Number | The milestone threshold crossed |

---

## Permissions

- Automated (Broadcast pipeline only)
- Delivered to designated milestone announcement channels

---

## Layout

1. Header
   - Milestone title (e.g. `🏆 Milestone Reached!`)
   - Target name
   - Timestamp
2. Achievement block
   - Milestone type label
   - Threshold value (formatted, e.g. `10,000,000 Fans`)
   - Crossed-at date
3. Trainer / circle identity
   - Avatar (if trainer)
   - Name and circle affiliation
4. Message body
   - Celebratory message from template
5. Footer
   - Source attribution

---

## Data Contract

The blueprint expects:

- `meta`
  - `targetId`
  - `targetType` — `trainer` or `circle`
  - `targetName`
  - `avatarUrl` (if trainer)
  - `circleName`
  - `generatedAt`
- `milestone`
  - `type` — `fans` or `rank`
  - `thresholdValue` — number
  - `thresholdDisplay` — formatted string, e.g. `10,000,000 Fans` or `Top 10`
  - `crossedAt` — `YYYY-MM-DD`
- `message`
  - `body` — celebratory text from template

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Vault | Source of trainer / circle historical records |
| 2 — Refinery | Refiner | Detect threshold crossing, compute milestone data |
| 2 — Refinery | Compiler | Assemble compiled milestone product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render milestone card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 5 — Broadcast | Broker | Trigger milestone notification job |
| 5 — Broadcast | Broadcast Inspector | Approve notification, deduplicate, resolve recipients |
| 5 — Broadcast | Archive | Store approved notification record |
| 5 — Broadcast | Announcer | Deliver milestone card via Workshop/Fabricator |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Duplicate milestone | Broadcast Inspector deduplicates — card not rendered |
| Target not found | Notification dropped; error logged |
| Avatar unavailable | Render card without avatar; do not fail |

---

## Performance Requirements

- Milestone detection debounced per 24-hour window (no duplicate notifications).
- Card rendered within 3 seconds of Announcer trigger.
- Avatar fetched at render time only.

---

## Workflow

```text
Threshold detected (Vault history / snapshot)
      │
      ▼
Broker — create milestone notification job
      │
      ▼
Broadcast Inspector — eligibility check, deduplication, recipient resolution
      │
      ▼
Archive — store approved notification record
      │
      ▼
Announcer — trigger Workshop/Fabricator to render milestone card
      │
      ▼
Workshop — Fabricator renders card using this blueprint
      │
      ▼
Announcer — deliver card to milestone announcement channel + DMs
```

---

## Implementation Notes

- Uses Vault history or stored snapshots to detect milestone crossings.
- Deduplication window: 24 hours per target per milestone threshold.
- Celebratory message templates are resolved from compiled product — not hardcoded in renderer.
- Both trainer and circle targets are supported; avatar is rendered for trainer targets only.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
