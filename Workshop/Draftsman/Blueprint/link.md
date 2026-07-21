# Link Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the structure for the `/link` interaction response.

It describes how a trainer account linking confirmation should be presented.

---

## Product Overview

The `/link` response is a simple confirmation card that acknowledges a successful link between a Discord user and a trainer profile.

---

## Command

```
/link
```

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trainer_id` | String | Yes | Trainer ID to link to the Discord account |

---

## Permissions

- All members (for linking own account)
- Administrators (for linking other accounts)

---

## Layout

1. Header
   - Confirmation title
   - Discord user identity
2. Link summary
   - Trainer identifier
   - Linked status
3. Notes
   - Next steps or privileges unlocked

---

## Data Contract

The blueprint expects:

- `meta`
  - `discordId`
  - `discordUsername`
  - `trainerId`
  - `trainerName`
  - `generatedAt`
- `link`
  - `status` — `linked` or `already_linked`
  - `message` — confirmation message
- `notes`
  - `summary` — next steps or privilege description

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Miner | Verify trainer ID exists via uma.moe |
| 1 — Umamoe | Inspector | Validate trainer identity fields |
| 1 — Umamoe | Vault | Store validated trainer identity |
| 2 — Refinery | Refiner | Resolve Discord ↔ trainer link |
| 2 — Refinery | Compiler | Assemble compiled link confirmation product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render link confirmation card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/link` interaction |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver confirmation card to Discord (ephemeral) |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Trainer ID not found | `❌ Trainer not found. Please check the ID and try again.` |
| Already linked | `⚠️ This Discord account is already linked to a trainer.` |
| Permission denied | `❌ You do not have permission to link this account.` |

---

## Performance Requirements

- Response time under 2 seconds.
- Link confirmation delivered as ephemeral (visible to requester only).

---

## Workflow

```text
Discord User
      │
      ▼
   /link trainer_id:<id>
      │
      ▼
Commands — validate input, check permissions
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Umamoe → Refinery → Depot (compiled link product)
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
