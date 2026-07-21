# /intercircleleaderboard

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show a unified cross-circle fan-gain leaderboard ranking members from all configured circles together.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `scope` | Choices | ❌ | `daily`, `weekly`, or `monthly` (defaults to `daily`) |
| `top` | Integer (10–30) | ❌ | Number of members to display (defaults to 10) |

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
  ├── Umamoe (fetch data from all configured circles)
  │       │
  │       ▼
  │   Refinery (merge, rank across circles)
  │       │
  │       ▼
  │   Workshop / Draftsman (render leaderboard blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image leaderboard combining members from all configured circles into one unified ranking.
- Useful for comparing performance across circles side by side.
- `top` is clamped between 10 and 30.
- Circle membership is shown alongside each member's rank entry.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| No circles configured | Ephemeral: "No circles are configured for this server." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |
| No data available | Ephemeral: "No leaderboard data is available yet. Try again after the next sync." |

---

## Example

```
/intercircleleaderboard
/intercircleleaderboard scope:weekly
/intercircleleaderboard scope:monthly top:20
```
