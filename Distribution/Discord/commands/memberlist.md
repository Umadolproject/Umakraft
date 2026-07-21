# /memberlist

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show the full circle roster — active members and former members with their last active date.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `list` | Boolean | ❌ | Show the full roster including former members (defaults to single lookup) |
| `member` | User | ❌ | Discord member to look up |
| `trainer` | String | ❌ | Uma.moe trainer name to look up — includes past members |

---

## Output

- **Single lookup:** Public embed.
- **List mode (`list:true`):** Two image reports posted publicly — current members and alumni.

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
  ├── Umamoe (fetch roster data from PastHistoryTrainer)
  │       │
  │       ▼
  │   Refinery (separate active vs former, sort by join date)
  │       │
  │       ▼
  │   Workshop / Draftsman (render memberlist blueprint — one or two images)
  │
  ▼
Dispatcher (post image(s) to channel)
```

---

## Behavior

- Sources historical data from `PastHistoryTrainer` for accuracy with former members.
- **Single lookup:** Shows join date and activity info for one member.
- **List mode (`list:true`):** Renders the full roster including former members with their last recorded active date.
- Replaces and extends the functionality of `/joindate`.
- Resolves `member` (Discord user) or `trainer` (Uma.moe name) for single lookups.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Member not found in roster | Ephemeral: "Member not found in the circle roster." |
| Trainer name not found | Ephemeral: "Trainer not found. Check the spelling or use autocomplete." |
| No roster data available | Ephemeral: "No roster data is available yet. Try again after the next sync." |
| Data sync failure | Ephemeral: "Could not retrieve data right now. Please try again shortly." |

---

## Example

```
/memberlist
/memberlist list:true
/memberlist member:@Trainer
/memberlist trainer:SmartFalcon
```
