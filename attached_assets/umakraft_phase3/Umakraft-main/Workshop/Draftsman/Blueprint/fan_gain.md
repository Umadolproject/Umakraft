# Fan Gain Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 2.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Defines the visual and data structure for the `/fan_gain` deliverable.

The fan gain report is a polished image card showing a trainer's identity, lifetime fan count, and daily / weekly / monthly gain metrics. It is designed for quick review and monitoring at a glance.

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
│                            🏇 Fangain Statistics                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  Username#0000                                             │
│  │              │  @username                                                 │
│  │   Avatar     │                                                            │
│  │   160×160    │  ┌──────────────────────────────────────────────────────┐  │
│  │              │  │             Lifetime Fangain                         │  │
│  └──────────────┘  │             12,458,224                               │  │
│                    └──────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐             │
│  │ Daily Fangain    │ │ Weekly Fangain   │ │ Monthly Fangain  │             │
│  │                  │ │                  │ │                  │             │
│  │ +125,000         │ │ +870,000         │ │ +3,240,000       │             │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘             │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Last Updated: Today 14:21                                       Rank #152    │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Sections

### 1 — Title bar
- Centered heading: `🏇 Fangain Statistics`
- Full width, top of card

### 2 — Identity row
Left column: Avatar (160 × 160 px, rounded)
Right column (stacked):
- Display name + discriminator — `Username#0000`
- Handle — `@username`
- Lifetime Fangain card (820 × 120 px) — label + large number

### 3 — Metrics row
Three equal cards side by side (320 × 170 px each):
- **Daily Fangain** — value prefixed with `+`
- **Weekly Fangain** — value prefixed with `+`
- **Monthly Fangain** — value prefixed with `+`

### 4 — Footer bar
- Left: `Last Updated: <date> <time>`
- Right: `Rank #<rank>`

---

## Component sizes

| Component | Size |
|-----------|------|
| Avatar | 160 × 160 px |
| Lifetime card | 820 × 120 px |
| Daily card | 320 × 170 px |
| Weekly card | 320 × 170 px |
| Monthly card | 320 × 170 px |
| Outer padding | 40 px |
| Card radius | 20–24 px |
| Gap | 24–32 px |

---

## Data contract

```json
{
  "meta": {
    "trainerId": "string",
    "trainerName": "string",
    "discordUsername": "string",
    "discriminator": "string",
    "avatarUrl": "string (URL)",
    "rank": "number",
    "generatedAt": "ISO timestamp"
  },
  "fans": {
    "lifetime": "number",
    "daily": "number",
    "weekly": "number",
    "monthly": "number"
  }
}
```

---

## Component definitions

### Identity row

| Field | Type | Description |
|-------|------|-------------|
| `avatarUrl` | string | URL of trainer's Discord avatar |
| `trainerName` | string | Display name with discriminator, e.g. `Username#0000` |
| `discordUsername` | string | Handle, e.g. `@username` |

### Lifetime card

| Field | Type | Description |
|-------|------|-------------|
| `fans.lifetime` | number | All-time cumulative fan count |

### Metrics row

| Field | Type | Description |
|-------|------|-------------|
| `fans.daily` | number | Fans gained in the last 24 hours |
| `fans.weekly` | number | Fans gained in the last 7 days |
| `fans.monthly` | number | Fans gained in the last 30 days |

### Footer

| Field | Type | Description |
|-------|------|-------------|
| `meta.generatedAt` | ISO timestamp | Rendered as human-readable date + time |
| `meta.rank` | number | Trainer's current rank, displayed as `Rank #N` |

---

## Validation rules

A valid deliverable must satisfy:

- `meta.trainerId` — present, non-empty string
- `meta.avatarUrl` — present, valid URL
- `meta.rank` — present, integer ≥ 1
- `fans.lifetime` — present, integer ≥ 0
- `fans.daily` — present, integer ≥ 0
- `fans.weekly` — present, integer ≥ 0
- `fans.monthly` — present, integer ≥ 0
- PNG buffer — non-null, size > 0

---

## Formatting rules

- All fan numbers formatted with locale comma separators, e.g. `12,458,224`
- Gain values in the metrics row prefixed with `+`
- `generatedAt` rendered as `Today HH:MM` if same day, otherwise `DD MMM HH:MM`
- Rank displayed as `Rank #N` with no leading zeros

---

## Notes

- The Fabricator fetches the avatar image from `avatarUrl` and embeds it directly — no external CDN calls at render time.
- Business logic (calculating gains, deriving rank) lives in the Refinery. The blueprint receives pre-computed values only.
- Layout C (Report Card family) base template does **not** apply here — fan_gain uses its own two-section structure (identity row + metrics row) distinct from the standard header/body/footer frame.

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Miner | Fetch trainer fan data from uma.moe |
| 1 — Umamoe | Inspector | Validate fan count fields and types |
| 1 — Umamoe | Vault | Store validated trainer fan records |
| 2 — Refinery | Refiner | Compute daily / weekly / monthly gains, trend |
| 2 — Refinery | Compiler | Assemble compiled fan gain product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render fan gain card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/fan_gain` interaction |
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
   /fan_gain
      │
      ▼
Commands — validate input
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Umamoe → Refinery → Depot (compiled fan gain product)
      │
      ▼
Workshop — Fabricator renders fan gain card using this blueprint
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
