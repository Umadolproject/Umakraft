# /leaderboard

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show the fan-gain leaderboard for a circle — daily, weekly, or monthly — with rank movement indicators.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `scope` | Choices | ❌ | `daily`, `weekly`, or `monthly` (defaults to `daily`) |
| `top` | Integer (10–30) | ❌ | Number of members to display (defaults to 10) |
| `circle` | Choices | ❌ | Which circle to check (defaults to the primary circle) |
| `date` | String | ❌ | Historical date in `YYYY-MM-DD` format to view a past leaderboard |

---

## Output

Image report — posted publicly in the channel.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, validate date format)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch leaderboard data)
  │       │
  │       ▼
  │   Refinery (rank, compute movement indicators)
  │       │
  │       ▼
  │   Workshop / Draftsman (render leaderboard blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image leaderboard.
- Shows rank movement (↑ / ↓ / —) compared to the previous period.
- `date` enables historical lookups — use `YYYY-MM-DD` format.
- `top` is clamped between 10 and 30.
- Uses the guild's primary circle if `circle` is not specified.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Invalid date format | Ephemeral: "Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-06-15`)." |
| Date in the future | Ephemeral: "Date cannot be in the future." |
| No data for requested date | Ephemeral: "No leaderboard data is available for that date." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/leaderboard
/leaderboard scope:weekly
/leaderboard scope:monthly top:20
/leaderboard date:2026-06-01 circle:UmaKraft
```
