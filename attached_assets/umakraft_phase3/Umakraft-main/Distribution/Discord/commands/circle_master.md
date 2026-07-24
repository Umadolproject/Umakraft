# /circle_master

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show the day-by-day Top 3 fan-gain contributors for the current month.

---

## Permissions

None — available to all members.
`trigger_milestones` option is restricted to admins (Manage Guild).

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `day` | Integer (1–31) | ❌ | Specific day to view (defaults to today) |
| `circle` | Choices | ❌ | Which circle to check (defaults to the primary circle) |
| `trigger_milestones` | Boolean | ❌ | Re-trigger milestone checks for the day — admin only |

---

## Output

Image report — posted publicly in the channel.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, check trigger_milestones permission)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch daily contributor data for the month)
  │       │
  │       ▼
  │   Refinery (aggregate Top 3 per day)
  │       │
  │       ▼
  │   Workshop / Draftsman (render circle_master blueprint)
  │
  ├── [if trigger_milestones] Coordinator runs milestone detection
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image report showing the Top 3 contributors for each day up to the selected day.
- Defaults to today if `day` is not specified.
- `trigger_milestones` re-runs milestone detection for the selected day; restricted to users with Manage Guild permission.
- Uses the guild's primary circle if `circle` is not specified.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| `day` out of range (< 1 or > 31) | Ephemeral: "Day must be between 1 and 31." |
| `day` exceeds current date | Ephemeral: "Day cannot be in the future." |
| `trigger_milestones` used without Manage Guild | Ephemeral: "You need the **Manage Guild** permission to use `trigger_milestones`." |
| No data for requested day | Ephemeral: "No contributor data is available for that day yet." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/circle_master
/circle_master day:15
/circle_master circle:UmaKraft day:1
/circle_master day:10 trigger_milestones:true
```
