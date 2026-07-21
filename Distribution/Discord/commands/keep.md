# /keep

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Mark a trainer card entry as permanently kept in the database, preventing automatic expiry.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `trainer_id` | String | ✅ | The Uma.moe trainer ID to mark as permanent |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate trainer_id format)
  │
  ▼
Coordinator
  │
  └── Umamoe (update keep flag in database)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- By default, trainer card entries are removed after 72 hours of inactivity.
- Using `/keep` sets a permanent flag on the entry so it is never automatically deleted.
- Requires a valid Uma.moe trainer ID (numeric string).

---

## Error Responses

| Condition | Response |
|-----------|----------|
| `trainer_id` not found in database | Ephemeral: "Trainer ID `{id}` was not found in the database. Use `/store` to add the card first." |
| `trainer_id` invalid format | Ephemeral: "Invalid trainer ID format. The ID must be a numeric value (e.g. `974470619`)." |
| Database update failure | Ephemeral: "Could not update the record right now. Please try again shortly." |

---

## Example

```
/keep trainer_id:974470619
```
