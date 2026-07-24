# /admin_setjoindate

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Manually override the join date recorded for a circle member.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `date` | String | ✅ | New join date in `YYYY-MM-DD` format |
| `member` | User | ❌ | Discord member to update |
| `trainer` | String | ❌ | Uma.moe trainer name to update |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate Manage Guild permission, validate date format,
          require member or trainer)
  │
  ▼
Coordinator
  │
  └── Umamoe (update join date in bot database store)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Updates the stored join date in the bot database (`store`).
- At least one of `member` or `trainer` must be provided to identify the target.
- `member` (Discord user) takes priority over `trainer` if both are supplied.
- Use when a member's join date was recorded incorrectly or needs a manual correction.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to use this command." |
| `date` missing | Ephemeral: "Please provide a `date` in `YYYY-MM-DD` format." |
| Invalid date format | Ephemeral: "Invalid date format. Use `YYYY-MM-DD` (e.g. `2025-04-01`)." |
| Date in the future | Ephemeral: "Join date cannot be in the future." |
| Neither `member` nor `trainer` provided | Ephemeral: "Please specify a `member` or `trainer` to update." |
| Member not found in database | Ephemeral: "Member not found. Make sure they are linked before setting a join date." |
| Database write failure | Ephemeral: "Could not update the join date right now. Please try again shortly." |

---

## Example

```
/admin_setjoindate date:2025-04-01 member:@TrainerName
/admin_setjoindate date:2025-04-01 trainer:SmartFalcon
```
