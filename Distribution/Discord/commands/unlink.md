# /unlink

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Remove the link between a Discord account and their Uma.moe trainer name.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `member` | User | ❌ | Discord member to unlink (defaults to yourself) |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, check Manage Guild permission)
  │
  ▼
Coordinator
  │
  └── Umamoe (remove link record from database)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Removes the Discord ↔ Uma.moe mapping from the bot database.
- After unlinking, fan gain stats will no longer be tracked for that member until they are re-linked with `/link`.
- Defaults to unlinking yourself if `member` is not specified.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to unlink members." |
| Member is not currently linked | Ephemeral: "This member is not currently linked to any trainer account." |
| Database update failure | Ephemeral: "Could not remove the link right now. Please try again shortly." |

---

## Example

```
/unlink
/unlink member:@Trainer
```
