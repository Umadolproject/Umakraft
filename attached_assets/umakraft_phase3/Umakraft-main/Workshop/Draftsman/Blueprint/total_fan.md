# Total Fan Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the `/total_fan` deliverable.

It specifies how a trainer's lifetime total fan count and current circle rank are rendered as a polished image card for quick identity and standing reference.

---

## Product Overview

The `/total_fan` card is a compact identity card showing a trainer's all-time accumulated fan count alongside their current rank within the circle. It is targeted at members who want a snapshot of their overall standing.

---

## Command

```
/total_fan
```

---

## Canvas

| Property | Value |
|----------|-------|
| Output format | PNG (via Puppeteer) |
| Canvas width | 1200 px |
| Outer padding | 40 px |
| Corner radius | 20–24 px |
| Gap between elements | 24–32 px |

---

## Layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           🏆 Total Fan Count                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  Username#0000                                             │
│  │              │  @username                                                 │
│  │   Avatar     │                                                            │
│  │   160×160    │  ┌──────────────────────────────────────────────────────┐  │
│  │              │  │             Lifetime Total Fans                      │  │
│  └──────────────┘  │             12,458,224                               │  │
│                    └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │ Circle Rank                          │  │ Circle                       │  │
│  │ #12                                  │  │ Aoharu Academy               │  │
│  └──────────────────────────────────────┘  └──────────────────────────────┘  │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Last Updated: Today 14:21                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Sections

### 1 — Title bar
- Centered heading: `🏆 Total Fan Count`
- Full width, top of card

### 2 — Identity row
Left column: Avatar (160 × 160 px, rounded)
Right column (stacked):
- Display name + discriminator — `Username#0000`
- Handle — `@username`
- Lifetime Total Fans card (820 × 120 px) — label + large number

### 3 — Stats row
Two cards side by side:
- **Circle Rank** — displayed as `#N`
- **Circle** — circle name

### 4 — Footer bar
- Left: `Last Updated: <date> <time>`

---

## Component sizes

| Component | Size |
|-----------|------|
| Avatar | 160 × 160 px |
| Lifetime card | 820 × 120 px |
| Circle Rank card | 560 × 120 px |
| Circle card | 560 × 120 px |
| Outer padding | 40 px |
| Card radius | 20–24 px |
| Gap | 24–32 px |

---

## Data Contract

```json
{
  "meta": {
    "trainerId": "string",
    "trainerName": "string",
    "discordUsername": "string",
    "discriminator": "string",
    "avatarUrl": "string (URL)",
    "circleName": "string",
    "circleRank": "number",
    "generatedAt": "ISO timestamp"
  },
  "fans": {
    "lifetime": "number"
  }
}
```

---

## Validation Rules

A valid deliverable must satisfy:

- `meta.trainerId` — present, non-empty string
- `meta.avatarUrl` — present, valid URL
- `meta.circleRank` — present, integer ≥ 1
- `meta.circleName` — present, non-empty string
- `fans.lifetime` — present, integer ≥ 0
- PNG buffer — non-null, size > 0

---

## Formatting Rules

- `fans.lifetime` formatted with locale comma separators, e.g. `12,458,224`
- Circle rank displayed as `#N` with no leading zeros
- `generatedAt` rendered as `Today HH:MM` if same day, otherwise `DD MMM HH:MM`

---

## Typography

| Element | Size |
|---------|-----:|
| Page Title | 32 px |
| Display Name | 22 px |
| Handle | 16 px |
| Lifetime Label | 16 px |
| Lifetime Value | 48 px |
| Stat Label | 16 px |
| Stat Value | 28 px |
| Footer | 14 px |

---

## Color Palette

| Item | Color |
|------|-------|
| Background | #FFF8FB |
| Card | #FFFFFF |
| Border | #E7D8F5 |
| Primary | #FF5AA5 |
| Secondary | #8A7CF7 |
| Text | #3A3552 |
| Rank Highlight | #FFD54F |
| Footer Text | #9E8EAE |

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Miner | Fetch trainer lifetime fan count from uma.moe |
| 1 — Umamoe | Inspector | Validate fan count fields and types |
| 1 — Umamoe | Vault | Store validated trainer fan records |
| 2 — Refinery | Refiner | Compute circle rank from member fan totals |
| 2 — Refinery | Compiler | Assemble compiled total fan product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render total fan card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/total_fan` interaction |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver card to Discord |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Trainer not found | `❌ Trainer not found.` |
| Avatar unavailable | Render card without avatar; do not fail |
| No fan data | `❌ No fan data available for this trainer.` |

---

## Workflow

```text
Discord User
      │
      ▼
   /total_fan
      │
      ▼
Commands — validate input
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Umamoe → Refinery → Depot (compiled total fan product)
      │
      ▼
Workshop — Fabricator renders total fan card using this blueprint
      │
      ▼
Dispatcher — deliver card to Discord
```

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
