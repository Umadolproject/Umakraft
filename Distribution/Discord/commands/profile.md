# /profile

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show a full profile dashboard for a circle member — fan gains, personal records, milestone badges, and month-by-month history.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `member` | User | ❌ | Discord member to look up (defaults to yourself) |
| `trainer` | String | ❌ | Uma.moe trainer name — supports autocomplete, includes past members |
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
  ├── Umamoe (fetch trainer profile and history)
  │       │
  │       ▼
  │   Refinery (transform and aggregate stats)
  │       │
  │       ▼
  │   Workshop / Draftsman (render profile blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts a detailed image profile card.
- Includes: current fan gain stats, personal records, milestone badges, and a month-by-month history chart.
- Resolves `member` (Discord user) or `trainer` (Uma.moe name) — `member` takes priority if both are supplied.
- Supports past members via `trainer` lookup even after they have left the circle.
- Leave all options blank to view your own profile.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Member is not linked | Ephemeral: "This member has not been linked to an Uma.moe account. Use `/link` to set one up." |
| Trainer name not found | Ephemeral: "Trainer not found. Check the spelling or use autocomplete." |
| No history data available | Ephemeral: "No profile data is available for this member yet. Try again after the next sync." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/profile
/profile member:@Trainer
/profile trainer:SmartFalcon
/profile trainer:SmartFalcon circle:UmaKraft
```
