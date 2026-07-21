# Join Date Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the structure for the `/joindate` deliverable.

It describes how a trainer's earliest circle join date and historical presence summary is rendered as a Discord response.

---

## Product Overview

The `/joindate` response is a compact information card reporting when a trainer first joined a circle, how long they have been a member, and any relevant historical presence flags derived from Vault records.

---

## Command

```
/joindate
```

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `trainer_id` | String | Yes | — | Target trainer ID |
| `circle_id` | String | No | Primary circle | Circle to check join date for |

---

## Permissions

- All members

---

## Layout

1. Header
   - Title: `Trainer Join Date`
   - Trainer name
   - Generated timestamp
2. Date summary
   - Joined date (formatted)
   - Duration since joining (e.g. `4y 3m`)
3. History flags (if available)
   - Notable presence milestones (e.g. first year anniversary, longest streak)
4. Footer
   - Source: Vault historical records

---

## Data Contract

The blueprint expects:

- `meta`
  - `trainerId`
  - `trainerName`
  - `circleId`
  - `circleName`
  - `generatedAt`
- `joindate`
  - `date` — `YYYY-MM-DD`
  - `durationDisplay` — formatted string, e.g. `4y 3m`
  - `daysActive` — integer
- `flags`
  - array of `{ label, description }` — notable historical presence events (may be empty)

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Vault | Source of historical trainer records |
| 2 — Refinery | Refiner | Derive join date, compute duration, extract flags |
| 2 — Refinery | Compiler | Assemble compiled joindate product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render join date card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/joindate` interaction |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver card to Discord |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Trainer not found | `❌ Trainer not found.` |
| No join date record | `❌ No join date record available for this trainer.` |
| Circle not found | `❌ Circle not found.` |

---

## Performance Requirements

- Response time under 2 seconds.
- Join date derived from Vault historical snapshots — no live API call required.

---

## Workflow

```text
Discord User
      │
      ▼
   /joindate trainer_id:<id>
      │
      ▼
Commands — validate input
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Vault (historical records) → Refinery → Depot (compiled product)
      │
      ▼
Workshop — Fabricator renders join date card using this blueprint
      │
      ▼
Dispatcher — deliver card to Discord
```

---

## Implementation Notes

- Join date is derived from Vault records or a past-history parser — not from a live API endpoint.
- Duration display uses the format `Xy Xm` (years and months); fall back to `Xm Xd` for less than one year.
- Historical presence flags are optional; render without them if none are present.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
