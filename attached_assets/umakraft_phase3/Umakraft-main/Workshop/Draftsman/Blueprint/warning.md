# Warning Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 2.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the visual and data structure for the warning / alert deliverable.

It describes how a standardized warning card is rendered for abnormal conditions — including API failures, fan gain anomalies, quota limits, and data integrity issues.

---

## Product Overview

The warning card is an alert-style image card delivered automatically by the Broadcast pipeline when the warning engine detects an abnormal condition. It is not triggered by a slash command — it is a Broadcast-initiated deliverable.

---

## Trigger

Broadcast pipeline (Broker → Broadcast Inspector → Announcer)

Not a slash command. Triggered automatically by the warning engine.

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
│ ⚠ WARNING SYSTEM                                                   HH:MM UTC │
│──────────────────────────────────────────────────────────────────────────────│
│  ● CRITICAL                                                        #FF5AA5   │
│  ALERT TITLE                                                        ALERT ID │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ERROR CODE                                                                   │
│ <errorCode>                                                                  │
│                                                                              │
│ DESCRIPTION                                                                  │
│ <description>                                                                │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ AFFECTED TARGET                                                              │
│                                                                              │
│ Trainer   : <trainerName>                                                    │
│ Circle    : <circleName>                                                     │
│ Target ID : <targetId>                                                       │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ CONTEXT                                                                      │
│──────────────────────────────────────────────────────────────────────────────│
│ <label>                   <value>                                            │
│ <label>                   <value>                                            │
│ …                                                                            │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ RECOMMENDED ACTIONS                                                          │
│                                                                              │
│ • <action>                                                                   │
│ • <action>                                                                   │
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Source: <source>                                                             │
│ Delivered via <pipeline>                                                     │
│ Monitoring Channel: <channel>                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Sections

### 1 — Header bar
- Left: `⚠ WARNING SYSTEM` — fixed label, always present
- Right: Timestamp — `HH:MM UTC` format, taken from `meta.generatedAt`

### 2 — Severity row
- Left: Severity badge — `● INFO` / `● WARNING` / `● CRITICAL` — colored dot matching severity
- Center: Alert title — `meta.alert.title` in uppercase
- Right: `ALERT ID` label (static label) with `meta.alertId` value below it
- Background strip color derived from severity level (see Severity Levels table)

### 3 — Error block
Two stacked label-value pairs, each on its own line:
- `ERROR CODE` label → `meta.errorCode` value
- `DESCRIPTION` label → `alert.description` value (wraps if long)

### 4 — Affected Target
Displayed only when at least one target field is present. Three optional rows:
- `Trainer   : <meta.targetName>` — omitted if absent
- `Circle    : <meta.circleName>` — omitted if absent
- `Target ID : <meta.targetId>` — omitted if absent

If no target fields are present, this section is omitted entirely.

### 5 — Context
Key-value table from `alert.context` array. Left column is the label, right column is the value. Rendered as aligned rows separated by a divider from the section title. Omitted if `alert.context` is empty.

### 6 — Recommended Actions
Bulleted list from `alert.remediation` array. Each item prefixed with `•`. Omitted if `alert.remediation` is empty.

### 7 — Footer
Three lines:
- `Source: <alert.source>`
- `Delivered via <alert.deliveredVia>`
- `Monitoring Channel: <alert.monitoringChannel>`

---

## Severity Levels

| Level | Badge | Color | Usage |
|-------|-------|-------|-------|
| `info` | `● INFO` | `#8A7CF7` | Informational notice; no action required |
| `warning` | `● WARNING` | `#FFD54F` | Abnormal condition; review recommended |
| `critical` | `● CRITICAL` | `#FF5AA5` | Serious issue; immediate attention required |

---

## Data Contract

```json
{
  "meta": {
    "alertId": "string",
    "severity": "info | warning | critical",
    "errorCode": "string",
    "generatedAt": "ISO timestamp",
    "targetId": "string (optional)",
    "targetName": "string (optional)",
    "circleName": "string (optional)"
  },
  "alert": {
    "title": "string",
    "description": "string",
    "context": [
      { "label": "string", "value": "string" }
    ],
    "remediation": ["string"],
    "source": "string",
    "deliveredVia": "string",
    "monitoringChannel": "string"
  }
}
```

---

## Validation Rules

A valid deliverable must satisfy:

| Field | Rule |
|-------|------|
| `meta.alertId` | present, non-empty string |
| `meta.severity` | one of `info`, `warning`, `critical` |
| `meta.errorCode` | present, non-empty string |
| `meta.generatedAt` | present, valid ISO timestamp |
| `alert.title` | present, non-empty string |
| `alert.description` | present, non-empty string |
| `alert.source` | present, non-empty string |
| `alert.deliveredVia` | present, non-empty string |
| `alert.monitoringChannel` | present, non-empty string |
| `alert.context` | array (may be empty) |
| `alert.remediation` | array (may be empty) |
| PNG buffer | non-null, size > 0 |

---

## Formatting Rules

- Timestamp in header rendered as `HH:MM UTC` from `meta.generatedAt`
- Alert title always rendered in uppercase
- Severity badge dot color matches the severity level color (see Severity Levels table)
- Context label column left-aligned; value column right-aligned within the panel width
- Numbers in context values formatted with locale comma separators, e.g. `30,153,000`
- Signed differences prefixed with `+` or `−` as appropriate
- Monitoring channel displayed with `#` prefix if not already present

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 2 — Refinery | Refiner | Detect anomalies, compute warning conditions |
| 2 — Refinery | Compiler | Assemble compiled warning product |
| 2 — Refinery | Depot | Persist and serve compiled product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render warning card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 5 — Broadcast | Broker | Trigger warning notification job |
| 5 — Broadcast | Broadcast Inspector | Approve notification, deduplicate, resolve recipients |
| 5 — Broadcast | Archive | Store approved notification record |
| 5 — Broadcast | Announcer | Deliver warning card to monitoring channel |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Duplicate warning (same error code, same target, within window) | Broadcast Inspector deduplicates — card not rendered |
| Unknown severity level | Default to `warning`; log classification error |
| Empty context array | Render card without Context section; do not fail |
| Empty remediation array | Render card without Recommended Actions section; do not fail |
| No target fields present | Render card without Affected Target section; do not fail |

---

## Performance Requirements

- Warning cards rendered within 2 seconds of Announcer trigger.
- `critical` severity cards bypass deduplication windows.
- `info` and `warning` severity deduplicated within a configurable time window.

---

## Workflow

```text
Warning condition detected (Refinery warning engine)
      │
      ▼
Broker — create warning notification job
      │
      ▼
Broadcast Inspector — eligibility check, deduplication, recipient resolution
      │
      ▼
Archive — store approved notification record
      │
      ▼
Announcer — trigger Workshop/Fabricator to render warning card
      │
      ▼
Workshop — Fabricator renders card using this blueprint
      │
      ▼
Announcer — deliver card to monitoring channel
```

---

## Implementation Notes

- Integrates with `umamoe/ERROR_HANDLING.md` error code classifications.
- Warning engine logic is pending assimilation into the Refinery (per `GOVERNANCE/PIPELINE_REGISTRY.md`).
- Daily, weekly, and monthly warning variants use the same blueprint with different `alert.context` payloads.
- `critical` alerts should also be logged to a dedicated monitoring channel separate from general announcements.
- Sections 4 (Affected Target), 5 (Context), and 6 (Recommended Actions) are conditionally rendered — Fabricator must omit them cleanly when their data is absent, not render empty boxes.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
