# Circle Blueprint

## Purpose

This blueprint defines the visual and data structure for the `/circle` deliverable.

It describes how a circle report should appear when requested via Discord, including circle identity, membership, and key metrics.

## Product overview

The `/circle` report is a summary card for a trainer's circle, focusing on circle performance, membership, and recent activity.

## Layout

1. Header
   - Circle title
   - Circle ID
   - Trainer name
2. Summary metrics
   - member count
   - total fan gain
   - active members
3. Circle history
   - recent circle events
4. Membership details
   - trainer role
   - join date
5. Notes
   - important flags or callouts

---

## Layout Specification v1.0

### Canvas

| Property | Value |
|----------|------:|
| Resolution | **1080 × 1350 px** |
| Aspect Ratio | 4:5 |
| Background | #FFF8FB |
| Safe Margin | 40 px |
| Card Radius | 24 px |
| Card Padding | 20 px |
| Gap Between Sections | 20 px |

### Overall Layout

```
Canvas
├── Header
├── Summary Metrics
├── Membership
├── Circle History
└── Notes
```

### 1. Header

Position
```
X: 40
Y: 40
```

Size
```
1000 × 180 px
```

Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Circle Name                                                  │
│ Circle ID: XXXXX                                             │
│ Trainer: Umakraft                                            │
│ Generated: YYYY-MM-DD HH:mm                                  │
└──────────────────────────────────────────────────────────────┘
```

Contents
- Circle Title (32 px)
- Circle ID (18 px)
- Trainer Name (18 px)
- Generated At (16 px)

---

### 2. Summary Metrics

Position
```
X: 40
Y: 240
```

Size
```
1000 × 180 px
```

Layout
```
┌──────────────┬──────────────┬──────────────┐
│ Members      │ Total Gain   │ Active       │
│              │              │ Members      │
│     30       │ 21,534,221   │     28       │
└──────────────┴──────────────┴──────────────┘
```

Each Metric Card
```
320 × 140 px
```

Contents
- Label
- Large Value

---

### 3. Membership Details

Position
```
X: 40
Y: 440
```

Size
```
1000 × 140 px
```

Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Membership                                                   │
│                                                              │
│ Role        : Leader                                         │
│ Joined Date : 2025-02-18                                     │
└──────────────────────────────────────────────────────────────┘
```

---

### 4. Circle History

Position
```
X: 40
Y: 600
```

Size
```
1000 × 500 px
```

Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Recent Circle Activity                                       │
├──────────────────────────────────────────────────────────────┤
│ • New member joined                                          │
│ • Circle reached 20M fan gain                                │
│ • Trainer promoted                                           │
│ • Monthly ranking updated                                    │
│ • Member left                                                │
│ • Weekly fan gain record                                     │
│ • New milestone unlocked                                     │
└──────────────────────────────────────────────────────────────┘
```

Display
- Maximum 8–10 events
- Scrollable internally if rendered as HTML
- Otherwise truncate with "...and X more"

Each Row Height
```
42 px
```

---

### 5. Notes

Position
```
X: 40
Y: 1120
```

Size
```
1000 × 190 px
```

Layout
```
┌──────────────────────────────────────────────────────────────┐
│ Notes                                                        │
│                                                              │
│ Current summary or important flags for the trainer's circle. │
│ Can include warnings, announcements, or achievements.        │
└──────────────────────────────────────────────────────────────┘
```

Supports
- Multi-line text
- Markdown removed before rendering
- Maximum 4 lines

---

### Typography

| Element | Size |
|---------|-----:|
| Page Title | 36 px |
| Section Title | 24 px |
| Metric Value | 30 px |
| Body Text | 18 px |
| Small Text | 16 px |

---

### Color Palette

| Item | Color |
|------|-------|
| Background | #FFF8FB |
| Card | #FFFFFF |
| Border | #E7D8F5 |
| Primary | #FF5AA5 |
| Secondary | #8A7CF7 |
| Text | #3A3552 |
| Success | #55C271 |

---

### Component Tree

```
1080 × 1350
│
├── Header (1000×180)
│
├── Summary Metrics (1000×180)
│   ├── Member Count (320×140)
│   ├── Total Fan Gain (320×140)
│   └── Active Members (320×140)
│
├── Membership (1000×140)
│
├── Circle History (1000×500)
│
└── Notes (1000×190)
```

---

### Estimated Height

| Section | Height |
|---------|--------:|
| Header | 180 px |
| Summary | 180 px |
| Membership | 140 px |
| History | 500 px |
| Notes | 190 px |
| Margins & Gaps | ~160 px |
| **Total** | **1350 px** |

---

## Data contract

The blueprint expects:

- `meta`
  - `circleId`
  - `trainerId`
  - `trainerName`
  - `generatedAt`
- `metrics`
  - `memberCount`
  - `totalFanGain`
  - `activeMembers`
- `history`
  - `events`: array of { `label`, `value` }
- `membership`
  - `role`
  - `joinDate`
- `notes`
  - `summary`

## Workflow

```text
Discord User
      │
      ▼
   /circle
      │
      ▼
Command validates request
      │
      ▼
Distribution/Retriever fetches approved circle product
      │
      ▼
Delivery renders the report using the Circle blueprint
      │
      ▼
Discord Response
```
