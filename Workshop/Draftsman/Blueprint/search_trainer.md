# Search Trainer Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the `/search_trainer` deliverable.

It specifies how a trainer card lookup result is rendered — showing the trainer's identity, rank, stats, and stored support card data from the database.

---

## Product Overview

The `/search_trainer` card is an information card presenting a trainer found in the card database. It targets members looking up a specific trainer's stored card data, rank, and skills at a glance.

---

## Command

```
/search_trainer
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
│                            🔍 Trainer Search Result                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  TrainerName                                               │
│  │              │  Rank #42                                                  │
│  │   Avatar /   │                                                            │
│  │   Card Art   │  ┌────────────────────────────────────────────────────┐   │
│  │   160×160    │  │ Linked Discord : @username                         │   │
│  │              │  │ Stored Since   : 2026-01-15                        │   │
│  └──────────────┘  └────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │ Total Fans       │ │ Monthly Gain     │ │ Daily Gain       │             │
│  │ 12,458,224       │ │ +1,240,000       │ │ +125,000         │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                          Support Card Data                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │ Card Name : Speed SSR Card A                                         │   │
│  │ Skill 1   : Speed Up (L)        Skill 2 : Recovery Boost (M)        │   │
│  │ Skill 3   : Final Sprint (L)    Skill 4 : Stamina Guard (S)         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Last Updated: Today 14:21                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Sections

### 1 — Title bar
- Centered heading: `🔍 Trainer Search Result`
- Full width, top of card

### 2 — Identity row
Left column: Avatar or card art (160 × 160 px, rounded)
Right column (stacked):
- Trainer name (22 px, bold)
- Rank displayed as `Rank #N` (18 px)
- Info card (820 × 80 px):
  - Linked Discord handle
  - Stored since date

### 3 — Stats row
Three equal cards side by side (320 × 120 px each):
- **Total Fans** — lifetime count
- **Monthly Gain** — current month, prefixed with `+`
- **Daily Gain** — today's gain, prefixed with `+`

### 4 — Support Card Data block
Full-width card (1120 × 120 px):
- Card name
- Up to 4 skills displayed in a 2×2 grid with tier label

### 5 — Footer bar
- Left: `Last Updated: <date> <time>`

---

## Component Sizes

| Component | Size |
|-----------|------|
| Avatar / Card Art | 160 × 160 px |
| Info card | 820 × 80 px |
| Stat card (×3) | 320 × 120 px |
| Support Card block | 1120 × 120 px |
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
    "avatarUrl": "string (URL) | null",
    "discordHandle": "string | null",
    "rank": "number",
    "storedSince": "YYYY-MM-DD",
    "generatedAt": "ISO timestamp"
  },
  "fans": {
    "lifetime": "number",
    "monthly": "number",
    "daily": "number"
  },
  "supportCard": {
    "cardName": "string | null",
    "skills": [
      {
        "name": "string",
        "tier": "S | M | L | null"
      }
    ]
  }
}
```

---

## Validation Rules

A valid deliverable must satisfy:

- `meta.trainerId` — present, non-empty string
- `meta.trainerName` — present, non-empty string
- `meta.rank` — present, integer ≥ 1
- `fans.lifetime` — present, integer ≥ 0
- PNG buffer — non-null, size > 0

---

## Formatting Rules

- All fan numbers formatted with locale comma separators
- Gain values prefixed with `+`
- `storedSince` formatted as `YYYY-MM-DD`
- `generatedAt` rendered as `Today HH:MM` if same day, otherwise `DD MMM HH:MM`
- Skills rendered as `Skill Name (Tier)` e.g. `Speed Up (L)`; omit tier label if null
- Missing support card data renders the block as `No card data stored.`

---

## Typography

| Element | Size |
|---------|-----:|
| Page Title | 30 px |
| Trainer Name | 22 px |
| Rank | 18 px |
| Info Label | 14 px |
| Info Value | 16 px |
| Stat Label | 14 px |
| Stat Value | 28 px |
| Card Name | 16 px |
| Skill Text | 14 px |
| Footer | 12 px |

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
| Skill Tier S | #FF5AA5 |
| Skill Tier M | #8A7CF7 |
| Skill Tier L | #55C271 |
| Footer Text | #9E8EAE |

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Miner | Fetch trainer data and card records from database |
| 1 — Umamoe | Inspector | Validate trainer record and card data structure |
| 1 — Umamoe | Vault | Store validated trainer card records |
| 2 — Refinery | Refiner | Resolve trainer identity, compute fan stats |
| 2 — Refinery | Compiler | Assemble compiled search trainer product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render search trainer card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/search_trainer` interaction |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver card to Discord |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Trainer not found | `❌ Trainer not found. Check the spelling or use autocomplete.` |
| No card data stored | Render card without support card block; show `No card data stored.` |
| Avatar unavailable | Render card without avatar; do not fail |

---

## Workflow

```text
Discord User
      │
      ▼
   /search_trainer [name] [rank] [skills]
      │
      ▼
Commands — validate input
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Umamoe → Refinery → Depot (compiled search trainer product)
      │
      ▼
Workshop — Fabricator renders trainer card using this blueprint
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
