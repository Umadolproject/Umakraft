# Join Date Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 2.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This blueprint defines the visual and data structure for the `/joindate` deliverable.

It describes how a trainer's earliest circle join date, membership duration, and historical presence flags are rendered as a compact membership record card.

---

## Product Overview

The `/joindate` response is a compact information card reporting when a trainer first joined a circle, how long they have been a member, their total active days, and any notable presence milestones derived from Vault records.

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

## Canvas

| Property | Value |
|----------|-------|
| Output format | PNG (via Puppeteer) |
| Canvas width | 900 px |
| Canvas height | Content-driven (auto) |
| Background | `#FFF8FB` |
| Outer padding | 40 px |
| Corner radius | 20–24 px |
| Gap between sections | 16 px |

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ 📅 TRAINER JOIN DATE                                    YYYY-MM-DD  HH:MM   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ╭──────╮   Trainer Name                                                    │
│   │      │   Circle : <circleName>                                           │
│   ╰──────╯                                                                   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Joined          <YYYY-MM-DD>                                               │
│   Membership      <Xy Xm>                                                    │
│   Days Active     <N>                                                        │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ PRESENCE FLAGS                                                               │
│                                                                              │
│  • <label>        <description>                                              │
│  • <label>        <description>                                              │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source : Vault Historical Records                              uma.moe       │
└──────────────────────────────────────────────────────────────────────────────┘
```

> The Presence Flags section is omitted entirely when `flags` is empty.

---

## Visual Hierarchy

```
Header
──────────────
Identity
──────────────
Membership Record
──────────────
Presence Flags  (conditional)
──────────────
Footer
```

---

## Sections

### 1 — Header

| Property | Value |
|----------|-------|
| Size | 820 × 80 px |
| Position | X: 40, Y: 40 |

Contents:
- Left: `📅 TRAINER JOIN DATE` — fixed label
- Right: `YYYY-MM-DD  HH:MM` — from `meta.generatedAt`
- Background: Primary pink (`#FF5AA5`)
- Typography: white, bold

---

### 2 — Identity

| Property | Value |
|----------|-------|
| Size | 820 × 110 px |
| Position | X: 40, Y: 140 |

Layout — avatar left, text right:

| Sub-component | Size | Content |
|---------------|------|---------|
| Avatar | 80 × 80 px | Discord avatar, circular, rounded border |
| Trainer name | — | Display name, large |
| Circle label | — | `Circle : <circleName>`, subdued |

Avatar is fetched from `meta.avatarUrl` at render time. If unavailable, render a placeholder circle — do not fail.

---

### 3 — Membership Record

| Property | Value |
|----------|-------|
| Size | 820 × 140 px |
| Position | X: 40, below Identity |

Three label-value rows, left-aligned with fixed label column width (140 px):

| Label | Value |
|-------|-------|
| `Joined` | `joindate.date` — `YYYY-MM-DD` |
| `Membership` | `joindate.durationDisplay` — e.g. `4y 3m` or `8m 12d` |
| `Days Active` | `joindate.daysActive` — integer, comma-formatted |

Label: subdued gray (`#8A7CF7`), 16 px
Value: dark text (`#3A3552`), 18 px, bold

---

### 4 — Presence Flags *(conditional)*

| Property | Value |
|----------|-------|
| Size | 820 × variable |
| Position | X: 40, below Membership Record |

Rendered only when `flags` array is non-empty. Omitted entirely if no flags.

Section title: `PRESENCE FLAGS` — uppercase, 16 px, subdued

Each flag is one row:
- `•` bullet prefix
- **Label** — `flags[n].label` — 14 px, bold, pink (`#FF5AA5`)
- Description — `flags[n].description` — 14 px, regular, dark text

Row height: 28 px. No maximum flag count enforced at blueprint level.

---

### 5 — Footer

| Property | Value |
|----------|-------|
| Size | 820 × 50 px |
| Position | X: 40, bottom |

- Left: `Source : Vault Historical Records`
- Right: `uma.moe`
- Typography: subdued gray, 13 px

---

## Component Sizes — Full Reference

| Component | Size |
|-----------|------|
| Canvas | 900 × auto px |
| Header | 820 × 80 px |
| Identity | 820 × 110 px |
| Avatar | 80 × 80 px |
| Membership Record | 820 × 140 px |
| Presence Flags | 820 × variable px |
| Footer | 820 × 50 px |
| Outer padding | 40 px |
| Section gap | 16 px |
| Card radius | 20–24 px |

---

## Data Contract

```json
{
  "meta": {
    "trainerId": "string",
    "trainerName": "string",
    "avatarUrl": "string (URL)",
    "circleId": "string",
    "circleName": "string",
    "generatedAt": "ISO timestamp"
  },
  "joindate": {
    "date": "YYYY-MM-DD",
    "durationDisplay": "string",
    "daysActive": "number"
  },
  "flags": [
    { "label": "string", "description": "string" }
  ]
}
```

---

## Validation Rules

A valid deliverable must satisfy:

| Field | Rule |
|-------|------|
| `meta.trainerId` | present, non-empty string |
| `meta.trainerName` | present, non-empty string |
| `meta.circleId` | present, non-empty string |
| `meta.circleName` | present, non-empty string |
| `meta.generatedAt` | present, valid ISO timestamp |
| `joindate.date` | present, matches `YYYY-MM-DD` |
| `joindate.durationDisplay` | present, non-empty string |
| `joindate.daysActive` | present, integer ≥ 0 |
| `flags` | array (may be empty) |
| Each flag entry | both `label` and `description` present |
| PNG buffer | non-null, size > 0 |

---

## Formatting Rules

- `joindate.date` displayed as-is (`YYYY-MM-DD`)
- `joindate.durationDisplay`: `Xy Xm` format for ≥ 1 year (e.g. `4y 3m`); `Xm Xd` for < 1 year (e.g. `8m 12d`)
- `joindate.daysActive` formatted with locale comma separators for values ≥ 1,000
- Header timestamp rendered as `YYYY-MM-DD  HH:MM` (double-space between date and time) from `meta.generatedAt`
- Footer `uma.moe` right-aligned within footer row

---

## Color Palette

| Element | Color |
|---------|-------|
| Background | `#FFF8FB` |
| Card / section background | `#FFFFFF` |
| Border | `#E7D8F5` |
| Primary (header, flag labels) | `#FF5AA5` |
| Secondary (membership labels) | `#8A7CF7` |
| Text | `#3A3552` |
| Footer / subdued text | `#9E9E9E` |

---

## Typography

| Element | Size | Weight |
|---------|------|--------|
| Header title | 22 px | Bold |
| Header timestamp | 14 px | Regular |
| Trainer name | 20 px | Bold |
| Circle label | 15 px | Regular |
| Membership label | 16 px | Regular |
| Membership value | 18 px | Bold |
| Flag label | 14 px | Bold |
| Flag description | 14 px | Regular |
| Footer | 13 px | Regular |

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Vault | Source of historical trainer records |
| 2 — Refinery | Refiner | Derive join date, compute duration and days active, extract flags |
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
| Avatar unavailable | Render card without avatar; show placeholder circle |

---

## Performance Requirements

- Response time under 2 seconds.
- Join date derived from Vault historical snapshots — no live API call required.
- Avatar fetched at render time only.

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
Vault (historical records) → Refinery → Depot (compiled joindate product)
      │
      ▼
Workshop — Fabricator renders join date card using this blueprint
      │
      ▼
Dispatcher — deliver card to Discord
```

---

## Implementation Notes

- Join date is derived from Vault records — not from a live API endpoint.
- Duration format: `Xy Xm` (years + months) for memberships ≥ 1 year; `Xm Xd` (months + days) for < 1 year.
- Presence flags are optional — render the card without the Presence Flags section if `flags` is empty.
- `meta.avatarUrl` is present when the trainer has a linked Discord account; fall back to a placeholder if absent or fetch fails.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
