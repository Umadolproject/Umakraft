# Set Fans Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the structure for the `/set_fans` interaction response.

It describes how a fan count update confirmation should be presented after an administrator manually sets a trainer's fan count.

---

## Product Overview

The `/set_fans` response is a lightweight confirmation card that acknowledges the update and displays the new fan count, the trainer affected, and the administrator who performed the action.

---

## Command

```
/set_fans
```

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trainer_id` | String | Yes | Target trainer ID |
| `fans` | Integer | Yes | New fan count to set |

---

## Permissions

- Administrators only

---

## Layout

1. Header
   - Confirmation title
   - Generated timestamp
2. Update summary
   - Trainer name and ID
   - Previous fan count
   - New fan count
   - Changed by (administrator)
3. Notes
   - Any flags or warnings about the update (e.g. large delta)

---

## Data Contract

The blueprint expects:

- `meta`
  - `trainerId`
  - `trainerName`
  - `administratorId`
  - `administratorName`
  - `generatedAt`
- `update`
  - `previousFans` — integer (may be null if no prior record)
  - `newFans` — integer
  - `delta` — integer (positive or negative)
- `notes`
  - `summary` — optional flag or warning text

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Vault | Store updated fan count as trusted record |
| 2 — Refinery | Refiner | Compute delta, validate update bounds |
| 2 — Refinery | Compiler | Assemble compiled set_fans confirmation product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render confirmation card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/set_fans` interaction |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver confirmation card to Discord (ephemeral) |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Trainer not found | `❌ Trainer not found.` |
| Permission denied | `❌ You do not have permission to use this command.` |
| Invalid fan count | `❌ Fan count must be a positive integer.` |

---

## Performance Requirements

- Response time under 2 seconds.
- Delivered as ephemeral (visible to administrator only).

---

## Workflow

```text
Discord User (Administrator)
      │
      ▼
   /set_fans trainer_id:<id> fans:<count>
      │
      ▼
Commands — validate input, check administrator permission
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Vault (store) → Refinery → Depot (compiled confirmation product)
      │
      ▼
Workshop — Fabricator renders confirmation card using this blueprint
      │
      ▼
Dispatcher — deliver ephemeral card to Discord
```

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
