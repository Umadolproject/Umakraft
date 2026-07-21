# Profile Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 3 — Workshop (Generate Presentation Artifacts)
**Last Updated:** 2026-07-21

---

## Purpose

Defines the visual and data structure for the `/profile` deliverable.

The profile report is a full-length image card (portrait format) covering trainer identity, fan gain summary, performance callouts, all-time stats, yearly performance, fan history, milestones, team stadium breakdown, and commentary. It is the most comprehensive single-trainer deliverable in the pipeline.

---

## Canvas

| Property | Value |
|----------|-------|
| Output format | PNG (via Puppeteer) |
| Canvas width | 1080 px |
| Canvas height | 1920 px |
| Outer padding | 40 px |
| Corner radius | 20–24 px |
| Gap between sections | 24–32 px |

---

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│                      UMAKRAFT PROFILE                        │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  Trainer Name                              │
│ │              │  @Discord Username                         │
│ │ Discord      │─────────────────────────────────────────── │
│ │ Avatar       │ Trainer ID : XXXXXXXX                      │
│ │ 180×180      │ Discord ID: XXXXXXXXXXXXX                  │
│ │              │ Circle     : Aoharu                        │
│ └──────────────┘ Joined     : 2025-04-01                    │
├──────────────────────────────────────────────────────────────┤
│                      FAN GAIN SUMMARY                        │
│                                                              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐                │
│ │ Daily      │ │ Weekly     │ │ Monthly    │                │
│ │ +145,221   │ │ +892,500   │ │ +3,250,000 │                │
│ └────────────┘ └────────────┘ └────────────┘                │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐ │
│ │              Lifetime Fan Gain                           │ │
│ │                18,532,456                               │ │
│ └──────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│ Best Performance : Team Stadium Rank #15                    │
│ Rolling Gain     : +3.2M / Month                            │
├──────────────────────────────────────────────────────────────┤
│                    ALL-TIME STATS          YEARLY PERF 📈   │
│──────────────────────────────────────────────────────────────│
│ Total Fans        18,532,456   2025 ████████████ 4.2M       │
│ Total Gain        12,831,112   2026 ██████████████████ 9.1M │
│ Active Days       274          2027 ███ 1.5M                │
│ Average Daily     145,211                                   │
│ Average Weekly    915,422                                   │
│ Average Monthly   3,942,221                                 │
├──────────────────────────────────────────────────────────────┤
│ Recent Fan History                                          │
│──────────────────────────────────────────────────────────────│
│ Yesterday              +82,500                              │
│ Last Week              +903,000                             │
│ Last Month             +3,150,000                           │
│ 10M Fans               2025-08-02                           │
│ Joined Circle          2025-05-18                           │
├──────────────────────────────────────────────────────────────┤
│                  TEAM STADIUM                               │
├────────────┬────────────┬────────────┬────────────┬──────────┤
│ Sprint     │ Mile       │ Medium     │ Long       │ Dirt     │
│────────────│────────────│────────────│────────────│──────────│
│ Team Score │ Team Score │ Team Score │ Team Score │TeamScore │
│ 58,210     │ 60,331     │ 59,888     │ 61,422     │ 52,155   │
│            │            │            │            │          │
│ Avg Rank   │ Avg Rank   │ Avg Rank   │ Avg Rank   │ Avg Rank │
│ UG7        │ UG8        │ UG7        │ SS9        │ SS6      │
│            │            │            │            │          │
│ Top Horse  │ Top Horse  │ Top Horse  │ Top Horse  │ TopHorse │
│ Curren     │ Taiki      │ Dober      │ Top Gun    │ Falcon   │
│ Chan       │ Shuttle    │            │            │          │
├────────────┴────────────┴────────────┴────────────┴──────────┤
│ Commentary / Inheritance                                    │
│──────────────────────────────────────────────────────────────│
│ "Currently averaging 145k fan gain/day. Long-distance team  │
│ is strongest this season."                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## Sections and dimensions

### 1 — Header (1000 × 240 px)

| Sub-component | Size | Content |
|---------------|------|---------|
| Avatar | 180 × 180 px | Discord avatar, rounded |
| Trainer info block | remaining width | Name, username, IDs, circle, joined date |

Fields displayed:
- Trainer display name (large)
- `@discordUsername`
- `Trainer ID : <trainerId>`
- `Discord ID : <discordId>`
- `Circle     : <circleName>`
- `Joined     : <joinDate>`

---

### 2 — Fan Gain Summary (1000 × 250 px)

Section title: `FAN GAIN SUMMARY`

| Sub-component | Size | Content |
|---------------|------|---------|
| Daily card | 310 × 90 px | `Daily` label + `+N` value |
| Weekly card | 310 × 90 px | `Weekly` label + `+N` value |
| Monthly card | 310 × 90 px | `Monthly` label + `+N` value |
| Lifetime card | 960 × 110 px | `Lifetime Fan Gain` label + large number |

---

### 3 — Performance (1000 × 100 px)

Two inline callout rows:
- `Best Performance : <bestPerformance>` (e.g. `Team Stadium Rank #15`)
- `Rolling Gain     : <rollingGain>` (e.g. `+3.2M / Month`)

---

### 4 — All-Time Stats + Yearly Performance (side by side, total row height 280 px)

| Sub-component | Size | Content |
|---------------|------|---------|
| All-Time Stats panel | 480 × 280 px | 6-row stat table |
| Yearly Performance panel | 500 × 280 px | Bar rows per year with emoji header `📈` |

**All-Time Stats rows:**
- Total Fans
- Total Gain
- Active Days
- Average Daily
- Average Weekly
- Average Monthly

**Yearly Performance rows:** one bar row per year, e.g. `2025 ████████████ 4.2M`

---

### 5 — History (1000 × 220 px)

Section title: `Recent Fan History`

Two column types displayed as a unified list:

**Fan History entries** — label + formatted fan value (prefixed `+`)
**Milestone entries** — label + date string

Examples:
- `Yesterday` → `+82,500`
- `Last Week` → `+903,000`
- `Last Month` → `+3,150,000`
- `10M Fans` → `2025-08-02`
- `Joined Circle` → `2025-05-18`

---

### 6 — Team Stadium (1000 × 500 px)

Section title: `TEAM STADIUM`

Five equal-width columns (184 × 430 px each):

| Column | Surface |
|--------|---------|
| Sprint | sprint |
| Mile | mile |
| Medium | medium |
| Long | long |
| Dirt | dirt |

Each column contains three rows:
1. **Team Score** — numeric (e.g. `58,210`)
2. **Avg Rank** — grade string (e.g. `UG7`, `SS9`)
3. **Top Horse** — horse name (may be multi-word, e.g. `Curren Chan`)

---

### 7 — Commentary / Inheritance (1000 × 120 px)

Section title: `Commentary / Inheritance`

Free-text block. Displayed as a quoted paragraph, e.g.:
> "Currently averaging 145k fan gain/day. Long-distance team is strongest this season."

---

## Component sizes — full reference

| Component | Size |
|-----------|------|
| Canvas | 1080 × 1920 px |
| Header | 1000 × 240 px |
| Avatar | 180 × 180 px |
| Fan Summary section | 1000 × 250 px |
| Daily card | 310 × 90 px |
| Weekly card | 310 × 90 px |
| Monthly card | 310 × 90 px |
| Lifetime card | 960 × 110 px |
| Performance bar | 1000 × 100 px |
| All-Time Stats panel | 480 × 280 px |
| Yearly Performance panel | 500 × 280 px |
| History section | 1000 × 220 px |
| Team Stadium section | 1000 × 500 px |
| Stadium column (each) | 184 × 430 px |
| Commentary bar | 1000 × 120 px |
| Outer padding | 40 px |
| Card radius | 20–24 px |
| Gap between sections | 24–32 px |

---

## Data contract

```json
{
  "meta": {
    "trainerId": "string",
    "discordId": "string",
    "trainerName": "string",
    "discordUsername": "string",
    "avatarUrl": "string (URL)",
    "circleName": "string",
    "joinDate": "string (YYYY-MM-DD)",
    "generatedAt": "ISO timestamp"
  },
  "fans": {
    "daily": "number",
    "weekly": "number",
    "monthly": "number",
    "lifetime": "number"
  },
  "performance": {
    "bestPerformance": "string",
    "rollingGain": "string"
  },
  "stats": {
    "totalFans": "number",
    "totalGain": "number",
    "activeDays": "number",
    "averageDaily": "number",
    "averageWeekly": "number",
    "averageMonthly": "number"
  },
  "yearlyPerformance": [
    { "year": "number", "fanGain": "number" }
  ],
  "history": {
    "fanHistory": [
      { "label": "string", "value": "number" }
    ],
    "milestones": [
      { "label": "string", "date": "string (YYYY-MM-DD)" }
    ]
  },
  "stadium": {
    "sprint":  { "teamScore": "number", "avgRank": "string", "topHorse": "string" },
    "mile":    { "teamScore": "number", "avgRank": "string", "topHorse": "string" },
    "medium":  { "teamScore": "number", "avgRank": "string", "topHorse": "string" },
    "long":    { "teamScore": "number", "avgRank": "string", "topHorse": "string" },
    "dirt":    { "teamScore": "number", "avgRank": "string", "topHorse": "string" }
  },
  "commentary": "string"
}
```

---

## Validation rules

A valid deliverable must satisfy:

| Field | Rule |
|-------|------|
| `meta.trainerId` | present, non-empty string |
| `meta.discordId` | present, non-empty string |
| `meta.avatarUrl` | present, valid URL |
| `meta.joinDate` | present, matches `YYYY-MM-DD` |
| `fans.lifetime` | present, integer ≥ 0 |
| `fans.daily` | present, integer ≥ 0 |
| `fans.weekly` | present, integer ≥ 0 |
| `fans.monthly` | present, integer ≥ 0 |
| `stats.totalFans` | present, integer ≥ 0 |
| `stats.activeDays` | present, integer ≥ 0 |
| `yearlyPerformance` | array, at least 1 entry, each with `year` and `fanGain` |
| `history.fanHistory` | array, at least 1 entry |
| `history.milestones` | array (may be empty) |
| `stadium` | all 5 surfaces present (`sprint`, `mile`, `medium`, `long`, `dirt`) |
| each stadium surface | `teamScore` number, `avgRank` string, `topHorse` string |
| `commentary` | present, non-empty string |
| PNG buffer | non-null, size > 0 |

---

## Formatting rules

- All fan numbers formatted with locale comma separators, e.g. `18,532,456`
- Gain values prefixed with `+`, e.g. `+145,221`
- Rolling gain displayed with M/K shorthand, e.g. `+3.2M / Month`
- Yearly performance bar widths proportional to the largest year's `fanGain`
- `joinDate` displayed as-is (`YYYY-MM-DD`)
- Milestone dates displayed as-is (`YYYY-MM-DD`)
- History fan values prefixed with `+`
- Stadium `avgRank` displayed as-is (grade string, e.g. `UG7`, `SS9`)

---

## Notes

- Profile is a **unique layout** — it does not use the Layout C (Report Card) base template.
- Canvas is portrait (1080 × 1920 px), distinct from all other blueprints.
- The Fabricator fetches the avatar image from `avatarUrl` and embeds it at render time — no external CDN calls inside the template.
- Business logic (gain calculations, rank derivation) lives in the Refinery. This blueprint receives pre-computed values only.
- The yearly performance bar is a CSS-rendered bar (proportional `width` on a filled `div`), not a chart library.
- Commentary is free text — no character limit enforced at blueprint level, but the Fabricator should clamp to the 1000 × 120 px container.
