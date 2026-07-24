# Greeting Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 2.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This blueprint defines the visual and data structure for the `/greeting` deliverable.

It describes how a personalized greeting card is rendered for a trainer or circle — covering welcome messages, anniversaries, and milestone acknowledgements.

---

## Product Overview

The `/greeting` card is an image card that delivers a personalized message to a trainer or circle. It shows trainer identity centered on the card, a templated personal message body, and metadata confirming the template type and delivery context.

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
┌────────────────────────────────────────────────────────────────────────────┐
│ 🌸 WELCOME TO UMAKRAFT!                                 YYYY-MM-DD HH:MM  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                              ○ Discord Avatar                              │
│                                                                            │
│                           <trainerName>                                    │
│                          <circleName> Circle                               │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                           PERSONAL MESSAGE                                 │
│                                                                            │
│ <message.body>                                                             │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ TEMPLATE                                                                   │
│ <meta.template>                                                            │
│                                                                            │
│ TARGET TYPE                                                                │
│ <meta.targetType>                                                          │
│                                                                            │
│ GENERATED                                                                  │
│ <meta.generatedAt> UTC                                                     │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ <branding.footer>                                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Hierarchy

```
Header
──────────────
Identity
──────────────
Personal Message
──────────────
Metadata
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
- Left: greeting title — driven by `meta.template` (see Header Titles table below)
- Right: `YYYY-MM-DD HH:MM` from `meta.generatedAt`
- Background: accent color (`accent.color`); defaults to primary pink `#FF5AA5`
- Typography: white, bold

**Header Titles by Template**

| Template | Title |
|----------|-------|
| `welcome` | `🌸 WELCOME TO UMAKRAFT!` |
| `anniversary` | `🎉 CIRCLE ANNIVERSARY!` |
| `milestone` | `🏆 MILESTONE GREETING!` |

---

### 2 — Identity

| Property | Value |
|----------|-------|
| Size | 820 × 160 px |
| Position | X: 40, below Header |
| Alignment | Centered |

All elements centered horizontally:
- Discord avatar — circular, 100 × 100 px
- Trainer name — `meta.targetName`, large, bold
- Circle name — `meta.circleName` + ` Circle` suffix, subdued

Avatar is fetched from `meta.avatarUrl` at render time. Render a placeholder circle if unavailable — do not fail.

Circle suffix ` Circle` is appended by the Fabricator if not already present in `meta.circleName`.

---

### 3 — Personal Message

| Property | Value |
|----------|-------|
| Size | 820 × variable |
| Position | X: 40, below Identity |

- Section title: `PERSONAL MESSAGE` — centered, uppercase, 14 px, subdued gray
- Message body: `message.body` — left-aligned, 16 px, regular weight, word-wrapped within container
- No character limit enforced at blueprint level; Fabricator clamps to container height

The Workshop does **not** generate message text. Body is resolved upstream by the Refinery from the selected template.

---

### 4 — Metadata

| Property | Value |
|----------|-------|
| Size | 820 × 140 px |
| Position | X: 40, below Personal Message |

Three stacked label-value pairs, each on two lines (label above value):

| Label | Value |
|-------|-------|
| `TEMPLATE` | `meta.template` — capitalized (e.g. `Welcome`) |
| `TARGET TYPE` | `meta.targetType` — capitalized (e.g. `Trainer`) |
| `GENERATED` | `meta.generatedAt` rendered as `YYYY-MM-DD HH:MM UTC` |

Label: uppercase, 12 px, subdued gray (`#9E9E9E`)
Value: 15 px, bold, dark text (`#3A3552`)

---

### 5 — Footer

| Property | Value |
|----------|-------|
| Size | 820 × 50 px |
| Position | X: 40, bottom |

- `branding.footer` — full width, left-aligned, subdued gray, 13 px
- Example: `UmaKraft • Distribution Pipeline • Workshop Fabricator`

---

## Component Sizes — Full Reference

| Component | Size |
|-----------|------|
| Canvas | 900 × auto px |
| Header | 820 × 80 px |
| Identity | 820 × 160 px |
| Avatar | 100 × 100 px |
| Personal Message | 820 × variable px |
| Metadata | 820 × 140 px |
| Footer | 820 × 50 px |
| Outer padding | 40 px |
| Section gap | 16 px |
| Card radius | 20–24 px |

---

## Data Contract

```json
{
  "meta": {
    "targetId": "string",
    "targetType": "trainer | circle",
    "targetName": "string",
    "avatarUrl": "string (URL, optional)",
    "circleName": "string",
    "template": "welcome | anniversary | milestone",
    "generatedAt": "ISO timestamp"
  },
  "message": {
    "title": "string",
    "body": "string"
  },
  "accent": {
    "color": "string (hex, optional)"
  },
  "branding": {
    "footer": "string"
  }
}
```

---

## Validation Rules

A valid deliverable must satisfy:

| Field | Rule |
|-------|------|
| `meta.targetId` | present, non-empty string |
| `meta.targetType` | one of `trainer`, `circle` |
| `meta.targetName` | present, non-empty string |
| `meta.circleName` | present, non-empty string |
| `meta.template` | one of `welcome`, `anniversary`, `milestone` |
| `meta.generatedAt` | present, valid ISO timestamp |
| `message.body` | present, non-empty string |
| `branding.footer` | present, non-empty string |
| PNG buffer | non-null, size > 0 |

---

## Formatting Rules

- Header title selected from Header Titles table based on `meta.template`
- Header timestamp rendered as `YYYY-MM-DD HH:MM` (no seconds)
- `meta.template` displayed in Metadata section capitalized (e.g. `welcome` → `Welcome`)
- `meta.targetType` displayed in Metadata section capitalized (e.g. `trainer` → `Trainer`)
- Metadata `GENERATED` line rendered as `YYYY-MM-DD HH:MM UTC`
- Circle name in Identity row: Fabricator appends ` Circle` suffix if not already present
- `accent.color` defaults to `#FF5AA5` if absent or invalid hex

---

## Color Palette

| Element | Color |
|---------|-------|
| Background | `#FFF8FB` |
| Card / section background | `#FFFFFF` |
| Border | `#E7D8F5` |
| Primary / header default | `#FF5AA5` |
| Secondary | `#8A7CF7` |
| Text | `#3A3552` |
| Subdued / footer | `#9E9E9E` |

---

## Typography

| Element | Size | Weight | Alignment |
|---------|------|--------|-----------|
| Header title | 22 px | Bold | Left |
| Header timestamp | 14 px | Regular | Right |
| Trainer name | 20 px | Bold | Center |
| Circle name | 15 px | Regular | Center |
| Personal Message section title | 14 px | Regular | Center |
| Message body | 16 px | Regular | Left |
| Metadata label | 12 px | Regular | Left |
| Metadata value | 15 px | Bold | Left |
| Footer | 13 px | Regular | Left |

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Miner | Fetch trainer or circle identity from uma.moe |
| 1 — Umamoe | Inspector | Validate identity fields |
| 1 — Umamoe | Vault | Store validated identity record |
| 2 — Refinery | Refiner | Resolve target identity, select template, compose message body |
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
| Avatar unavailable | Render card without avatar; show placeholder circle |

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
   /greeting target_id:<id> template:<template>
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

- The Fabricator does **not** generate message text. All message content is resolved upstream by the Refinery.
- `accent.color` is used for the header background; defaults to `#FF5AA5` when absent.
- Avatar is rendered for `trainer` target type only; circle targets show the circle name without an avatar.
- `meta.avatarUrl` may be absent for circle targets — Fabricator must handle this gracefully.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
