# /fan_gain

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show daily, weekly, and monthly fan gain for a member, plus their current daily ranking.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `member` | User | ❌ | Discord member to look up (defaults to yourself) |
| `trainer` | String | ❌ | Uma.moe trainer name — supports autocomplete |
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
  ├── Umamoe (fetch fan gain data)
  │       │
  │       ▼
  │   Refinery (transform raw data)
  │       │
  │       ▼
  │   Workshop / Draftsman (render fan_gain blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image report showing daily, weekly, and monthly gain figures alongside the member's current daily rank.
- Leave all options blank to check your own stats.
- Resolves `member` (Discord user) or `trainer` (Uma.moe name) — `member` takes priority if both are supplied.
- Uses the guild's primary circle if `circle` is not specified.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Member is not linked | Ephemeral: "This member has not been linked to an Uma.moe account. Use `/link` to set one up." |
| Trainer name not found | Ephemeral: "Trainer not found. Check the spelling or use autocomplete." |
| No data available | Ephemeral: "No fan gain data is available for this member yet. Try again after the next sync." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/fan_gain
/fan_gain member:@Trainer
/fan_gain trainer:SmartFalcon
/fan_gain trainer:SmartFalcon circle:UmaKraft
```
