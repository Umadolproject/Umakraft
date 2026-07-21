# Greeting Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the `/greeting` deliverable.

It describes how a personalized greeting card is rendered for a trainer or circle — covering welcome messages, anniversaries, and milestone acknowledgements.

---

## Product Overview

The `/greeting` card is a lightweight image card that delivers a personalized message to a trainer or circle. It reuses identity components (avatar, trainer name) from the profile renderer and applies an accent color appropriate to the greeting type.

---

## Command

```
/greeting
```

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `target_id` | String | Yes | — | Trainer ID or circle ID to address |
| `template` | String | No | `welcome` | Message template: `welcome`, `anniversary`, `milestone` |

---

## Permissions

- All members

---

## Layout

1. Header
   - Greeting title
   - Target name (trainer or circle)
   - Generated timestamp
2. Message body
   - Personalized greeting text from template
3. Identity band
   - Avatar (if trainer target)
   - Trainer / circle name
4. Footer
   - Source attribution

---

## Data Contract

The blueprint expects:

- `meta`
  - `targetId`
  - `targetType` — `trainer` or `circle`
  - `targetName`
  - `avatarUrl` (if `targetType` is `trainer`)
  - `template` — `welcome` | `anniversary` | `milestone`
  - `generatedAt`
- `message`
  - `title`
  - `body`
- `accent`
  - `color` — hex color for card accent

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Miner | Fetch trainer or circle identity from uma.moe |
| 1 — Umamoe | Inspector | Validate identity fields |
| 1 — Umamoe | Vault | Store validated identity record |
| 2 — Refinery | Refiner | Resolve target identity, select template |
| 2 — Refinery | Compiler | Assemble compiled greeting product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render greeting card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/greeting` interaction |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver card to Discord (channel or DM) |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Target not found | `❌ Trainer or circle not found.` |
| Invalid template | `❌ Unknown greeting template.` |
| Avatar unavailable | Render card without avatar; do not fail |

---

## Performance Requirements

- Response time under 2 seconds.
- Avatar image fetched at render time only.
- Templates resolved from compiled product — no live API calls at render.

---

## Workflow

```text
Discord User
      │
      ▼
   /greeting
      │
      ▼
Commands — validate input, resolve target_id
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Umamoe → Refinery → Depot (compiled greeting product)
      │
      ▼
Workshop — Fabricator renders greeting card using this blueprint
      │
      ▼
Dispatcher — deliver card to Discord (channel or DM)
```

---

## Implementation Notes

- Reuse avatar and identity components from the profile renderer.
- Respect platform image aspect ratios (1:1 for DM, 16:9 or 4:5 for channel embeds).
- Support localized message templates where available.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
