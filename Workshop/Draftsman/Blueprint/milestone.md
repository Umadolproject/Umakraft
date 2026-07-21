# Milestone Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.1.0
**Last Updated:** 2026-07-22

---

## Purpose

This blueprint defines the visual and data structure for the milestone notification deliverable.

Milestone cards celebrate trainer achievements after the milestone engine validates that a configured threshold has been reached. The blueprint defines the rendering structure only — milestone detection, eligibility, duplicate prevention, and archival are handled by upstream pipeline departments.

---

## Product Overview

A milestone card is an automatically generated image card distributed by the Broadcast pipeline whenever a trainer reaches a configured milestone.

The rendered card provides:

- Trainer identity and circle affiliation
- Milestone information and achievement date
- Celebration message
- Pipeline attribution

---

## Trigger

Broadcast pipeline (Broker → Broadcast Inspector → Archive → Announcer → Workshop / Fabricator)

Not a slash command. Triggered automatically by threshold detection.

---

## Permissions

- Automated (Broadcast pipeline only)
- Delivered to designated milestone announcement channels

---

## Canvas

| Property | Value |
|----------|-------|
| Output format | PNG (via Puppeteer) |
| Canvas width | 900 px |
| Canvas height | Content-driven (auto) |
| Outer padding | 40 px |
| Corner radius | 20–24 px |
| Gap between sections | 16–24 px |

---

## Layout

```
┌────────────────────────────────────────────────────────────────────────────┐
│ 🏆 MILESTONE REACHED!                                      YYYY-MM-DD      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│        ○ Discord Avatar                                                    │
│                                                                            │
│        Trainer Name                                                        │
│        Circle: <circleName>                                                │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│                        ACHIEVEMENT                                         │
│                                                                            │
│                     <milestone.title>                                      │
│                                                                            │
│                 Milestone Type: <milestone.type>                           │
│                 Crossed: <milestone.crossedAt>                             │
│                                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│ "<message.body>"                                                           │
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
Achievement
──────────────
Celebration Message
──────────────
Footer
```

---

## Sections

### 1 — Header
- Left: `🏆 MILESTONE REACHED!` — fixed label, always present
- Right: Date — `YYYY-MM-DD` from `meta.generatedAt`
- Background: Pink (`#FF5AA5`)

### 2 — Identity
- Discord avatar — circular, centered (omitted gracefully if unavailable)
- Trainer name — uses trainer's assigned profile color
- Circle name — `Circle: <meta.circleName>`

Identity data originates from the compiled milestone product assembled by the Refinery.

### 3 — Achievement
Centered block with three lines:
- `ACHIEVEMENT` — section label
- `<milestone.title>` — the formatted threshold display (e.g. `10,000,000 Fans`) — rendered in bold
- `Milestone Type: <milestone.type>` — category label (e.g. `Fans`, `Weekly Fan Gain`)
- `Crossed: <milestone.crossedAt>` — date string (`YYYY-MM-DD`)

Supported milestone types:
- `Fans`
- `Monthly Fan Gain`
- `Weekly Fan Gain`
- `Daily Fan Gain`
- `Legacy`
- Future milestone types (Fabricator renders the supplied type without modification)

### 4 — Celebration Message
- Centered, quoted — `"<message.body>"`
- The Workshop does **not** generate celebration text; message is selected upstream by the milestone engine and passed via the compiled product

### 5 — Footer
- Pipeline attribution line — `<branding.footer>`
- Example: `UmaKraft • Broadcast Pipeline • Workshop Fabricator`
- Optional build metadata may be appended

---

## Data Contract

```json
{
  "meta": {
    "trainerId": "string",
    "trainerName": "string",
    "circleName": "string",
    "avatarUrl": "string (URL)",
    "generatedAt": "ISO timestamp"
  },
  "milestone": {
    "type": "string",
    "value": "number",
    "title": "string",
    "crossedAt": "YYYY-MM-DD"
  },
  "message": {
    "title": "string",
    "body": "string"
  },
  "branding": {
    "footer": "string"
  }
}
```

---

## Rendering Rules

- White background
- Black outer border and section dividers
- Pink header (`#FF5AA5`)
- Trainer name rendered in the trainer's assigned profile color
- Milestone value (`milestone.title`) rendered in bold
- Celebration message centered
- Footer rendered in subdued gray typography

---

## Validation Rules

A valid deliverable must satisfy:

| Field | Rule |
|-------|------|
| `meta.trainerId` | present, non-empty string |
| `meta.trainerName` | present, non-empty string |
| `meta.circleName` | present, non-empty string |
| `meta.generatedAt` | present, valid ISO timestamp |
| `milestone.type` | present, non-empty string |
| `milestone.value` | present, integer ≥ 0 |
| `milestone.title` | present, non-empty string |
| `milestone.crossedAt` | present, matches `YYYY-MM-DD` |
| `message.body` | present, non-empty string |
| `branding.footer` | present, non-empty string |
| PNG buffer | non-null, size > 0 |

---

## Formatting Rules

- `milestone.value` formatted with locale comma separators, e.g. `10,000,000`
- `milestone.crossedAt` displayed as-is (`YYYY-MM-DD`)
- Date in header rendered as `YYYY-MM-DD` from `meta.generatedAt`
- Celebration message wrapped in typographic quotes (`"…"`)

---

## Fabricator Responsibilities

The Fabricator is responsible for:

- Rendering the layout defined by this blueprint
- Formatting milestone values with comma separators
- Fetching and embedding the Discord avatar at render time
- Scaling text and preventing overflow within section containers
- Applying UmaKraft branding (colors, font weights)
- Exporting the final PNG

The Fabricator does **not**:

- Detect milestone thresholds
- Select celebration message text
- Validate milestone eligibility
- Determine notification recipients
- Send Discord messages

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Vault | Source of trainer historical fan records |
| 2 — Refinery | Refiner | Detect threshold crossing, compute milestone data |
| 2 — Refinery | Compiler | Assemble compiled milestone product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render milestone card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 5 — Broadcast | Broker | Trigger milestone notification job |
| 5 — Broadcast | Broadcast Inspector | Approve notification, deduplicate, resolve recipients |
| 5 — Broadcast | Archive | Store approved notification record |
| 5 — Broadcast | Announcer | Deliver milestone card via Workshop/Fabricator |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Duplicate milestone (same trainer, same threshold, within 24h) | Broadcast Inspector deduplicates — card not rendered |
| Trainer not found | Notification dropped; error logged |
| Avatar unavailable | Render card without avatar; do not fail |

---

## Performance Requirements

- Milestone detection debounced per 24-hour window (no duplicate notifications).
- Card rendered within 3 seconds of Announcer trigger.
- Avatar fetched at render time only.

---

## Workflow

```text
Threshold detected (Vault history / snapshot)
      │
      ▼
Broker — create milestone notification job
      │
      ▼
Broadcast Inspector — eligibility check, deduplication, recipient resolution
      │
      ▼
Archive — store approved notification record
      │
      ▼
Announcer — trigger Workshop/Fabricator to render milestone card
      │
      ▼
Workshop — Fabricator renders card using this blueprint
      │
      ▼
Announcer — deliver card to milestone announcement channel
```

---

## Repository Integration

This blueprint is implemented by the Workshop pipeline and consumes compiled milestone products produced by the Refinery.

```
Refinery/
    Refiner/
    Compiler/
    Depot/

Workshop/
    Draftsman/
        Blueprint/
            milestone.md        ← this file
    Fabricator/
    Validator/

Broadcast/
    Broker/
    Broadcast Inspector/
    Archive/
    Announcer/

Distribution/
    Commands/
        /profile                ← references milestone history
```

Milestone cards are delivered by the Broadcast pipeline. The `/profile` command may also reference completed milestone history when displaying a trainer's record.

---

## Implementation Notes

- Deduplication window: 24 hours per trainer per milestone threshold.
- Celebration message templates are resolved from the compiled product — not hardcoded in the renderer.
- Avatar is rendered for trainer targets only; avatar field may be null for circle-level milestones.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
