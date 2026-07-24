# /total_circlefan_gain

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show the total accumulated fan gain for the entire circle this month.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `circle` | Choices | ❌ | Which circle to check (defaults to the primary circle) |

---

## Output

Image report — posted publicly in the channel.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch monthly gain data for all active members)
  │       │
  │       ▼
  │   Refinery (sum and aggregate circle-wide gain)
  │       │
  │       ▼
  │   Workshop / Draftsman (render total_circlefan_gain blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image report showing the combined fan gain of all active circle members for the current month.
- Uses the guild's primary circle if `circle` is not specified.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| No circles configured | Ephemeral: "No circles are configured for this server." |
| No data available | Ephemeral: "No circle fan gain data is available yet. Try again after the next sync." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/total_circlefan_gain
/total_circlefan_gain circle:UmaKraft
```
