# /total_fan

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show a member's lifetime total fan count and their current circle rank.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `member` | User | ❌ | Discord member to look up (defaults to yourself) |
| `trainer` | String | ❌ | Uma.moe trainer name to look up |
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
  ├── Umamoe (fetch lifetime fan count and circle rank)
  │       │
  │       ▼
  │   Refinery (compute rank within circle)
  │       │
  │       ▼
  │   Workshop / Draftsman (render total_fan blueprint)
  │
  ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image report showing the member's all-time total fan count and their rank within the circle.
- Resolves `member` (Discord user) or `trainer` (Uma.moe name) — `member` takes priority if both are supplied.
- Leave all options blank to check your own totals.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Member is not linked | Ephemeral: "This member has not been linked to an Uma.moe account. Use `/link` to set one up." |
| Trainer name not found | Ephemeral: "Trainer not found. Check the spelling or use autocomplete." |
| No data available | Ephemeral: "No fan data is available for this member yet. Try again after the next sync." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/total_fan
/total_fan member:@Trainer
/total_fan trainer:SmartFalcon
/total_fan trainer:SmartFalcon circle:UmaKraft
```
