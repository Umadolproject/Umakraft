# /club_gain

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show the last 30 days of club gain history — daily progress, running totals, and performance statistics — in a spreadsheet-style image report.

---

## Permissions

- Club Owner
- Club Officers
- Administrators (optional)

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `club` | String | ❌ | View another club's report (Admin only) |
| `days` | Integer (1–30) | ❌ | Number of days to display (defaults to 30, max 30) |

---

## Output

Image report — posted publicly in the channel.

Rendered from blueprint: `Workshop/Draftsman/Blueprint/club_gain.md`

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, check permissions)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch club gain records)
  │       │
  │       ▼
  │   Refinery (compute daily deltas, running totals, summary stats)
  │       │
  │       ▼
  │   Workshop / Draftsman (render club_gain blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts a spreadsheet-style image card showing daily gain, running total, and a summary block (total, average, highest, lowest).
- Defaults to the requester's own club if `club` is not specified.
- `club` option is restricted to Administrators; non-admin use returns a permission error.
- `days` is clamped between 1 and 30.
- Results are cached for 10 minutes.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| No club gain data found | Ephemeral: "❌ No club gain data found for the last 30 days." |
| Club not found | Ephemeral: "❌ Club not found." |
| Permission denied | Ephemeral: "❌ You do not have permission to use this command." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/club_gain
/club_gain days:7
/club_gain club:AoharuAcademy
/club_gain club:AoharuAcademy days:14
```
