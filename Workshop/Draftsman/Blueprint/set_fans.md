# Set Fans Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 2.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the `/set_fans` confirmation deliverable.

It describes how a fan count update confirmation card is rendered after an administrator manually sets a trainer's fan count.

---

## Product Overview

The `/set_fans` response is a confirmation card that acknowledges a manual fan count update. It shows the affected trainer, the before/after fan counts, the administrator who performed the action, and any status notes from the update.

---

## Command

```
/set_fans
```

---

## Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `trainer_id` | String | Yes | Target trainer ID |
| `fans` | Integer | Yes | New fan count to set |

---

## Permissions

- Administrators only

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
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SET FANS CONFIRMATION                              │
│────────────────────────────────────────────────────────── YYYY-MM-DD HH:MM  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ✓ FAN COUNT UPDATED SUCCESSFULLY                      │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ TARGET TRAINER                                                               │
│                                                                              │
│ Trainer Name      <trainerName>                                              │
│ Trainer ID        <trainerId>                                                │
│ Circle            <circleName>                                               │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ FAN COUNT UPDATE                                                             │
│                                                                              │
│ Previous Fans    <previousFans>                                              │
│ New Fans         <newFans>                                                   │
│ Change           <delta>                                                     │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ ADMINISTRATOR                                                                │
│                                                                              │
│ Updated By       <administratorName>                                         │
│ Discord ID       <administratorDiscordId>                                    │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ NOTES                                                                        │
│                                                                              │
│ ✓ <statusLine>                                                               │
│ <warningLine>                                                                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source    : <source>                                                         │
│ Generated : <generatedAt> UTC                                                │
│ Delivery  : Ephemeral Response                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Sections

### 1 — Header bar
- Centered title: `SET FANS CONFIRMATION` — fixed label, always present
- Below a thin divider: timestamp right-aligned — `YYYY-MM-DD HH:MM` from `meta.generatedAt`

### 2 — Status row
- Centered confirmation line: `✓ FAN COUNT UPDATED SUCCESSFULLY`
- Always displayed on a successful update

### 3 — Target Trainer
Three left-aligned label-value rows:
- `Trainer Name` → `meta.trainerName`
- `Trainer ID` → `meta.trainerId`
- `Circle` → `meta.circleName`

### 4 — Fan Count Update
Three left-aligned label-value rows:
- `Previous Fans` → `update.previousFans` (formatted with commas; `—` if no prior record)
- `New Fans` → `update.newFans` (formatted with commas)
- `Change` → `update.delta` (prefixed `+` for positive, `−` for negative)

### 5 — Administrator
Two left-aligned label-value rows:
- `Updated By` → `meta.administratorName`
- `Discord ID` → `meta.administratorDiscordId`

### 6 — Notes
Two lines:
- Status line prefixed with `✓` — `notes.statusLine` (e.g. `Fan count updated manually.`)
- Warning line (no prefix) — `notes.warningLine` (e.g. `No validation warnings detected.`); omitted if absent

### 7 — Footer
Three lines:
- `Source    : <notes.source>`
- `Generated : <meta.generatedAt> UTC`
- `Delivery  : Ephemeral Response` — always fixed

---

## Data Contract

```json
{
  "meta": {
    "trainerId": "string",
    "trainerName": "string",
    "circleName": "string",
    "administratorName": "string",
    "administratorDiscordId": "string",
    "generatedAt": "ISO timestamp"
  },
  "update": {
    "previousFans": "number | null",
    "newFans": "number",
    "delta": "number"
  },
  "notes": {
    "statusLine": "string",
    "warningLine": "string (optional)",
    "source": "string"
  }
}
```

---

## Validation Rules

A valid deliverable must satisfy:

| Field | Rule |
|-------|------|
| `meta.trainerId` | present, non-empty string |
| `meta.trainerName` | present, non-empty string |
| `meta.circleName` | present, non-empty string |
| `meta.administratorName` | present, non-empty string |
| `meta.administratorDiscordId` | present, non-empty string |
| `meta.generatedAt` | present, valid ISO timestamp |
| `update.newFans` | present, integer ≥ 0 |
| `update.delta` | present, integer (positive or negative) |
| `notes.statusLine` | present, non-empty string |
| `notes.source` | present, non-empty string |
| PNG buffer | non-null, size > 0 |

---

## Formatting Rules

- All fan numbers formatted with locale comma separators, e.g. `145,620,000`
- `update.delta` prefixed with `+` for positive, `−` for negative, e.g. `+4,380,000`
- `update.previousFans` displayed as `—` when null (no prior record exists)
- Timestamp in header rendered as `YYYY-MM-DD HH:MM` (no seconds)
- Footer `Generated` line rendered as `YYYY-MM-DD HH:MM UTC`
- `Delivery` footer line is always `Ephemeral Response` — not data-driven

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 1 — Umamoe | Vault | Store updated fan count as trusted record |
| 2 — Refinery | Refiner | Compute delta, validate update bounds |
| 2 — Refinery | Compiler | Assemble compiled set_fans confirmation product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render confirmation card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/set_fans` interaction, check administrator permission |
| 4 — Distribution | Coordinator | Orchestrate pipeline, retrieve deliverable |
| 4 — Distribution | Dispatcher | Deliver confirmation card to Discord (ephemeral) |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Trainer not found | `❌ Trainer not found.` |
| Permission denied | `❌ You do not have permission to use this command.` |
| Invalid fan count (negative or non-integer) | `❌ Fan count must be a positive integer.` |

---

## Performance Requirements

- Response rendered within 2 seconds of command receipt.
- Delivered as ephemeral — visible to the administrator only.

---

## Workflow

```text
Discord User (Administrator)
      │
      ▼
   /set_fans trainer_id:<id> fans:<count>
      │
      ▼
Commands — validate input, check administrator permission
      │
      ▼
Coordinator — orchestrate pipeline
      │
      ▼
Vault (store) → Refinery → Depot (compiled confirmation product)
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
