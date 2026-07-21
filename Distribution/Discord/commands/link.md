# /link

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Link a Discord account to an Uma.moe trainer name so the bot can track that member's fan gains.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `circle` | Choices | ❌ | Which circle to link in (defaults to the primary circle) |
| `trainer` | String | ❌ | Uma.moe trainer name — supports autocomplete |
| `trainer_id` | String | ❌ | Uma.moe trainer ID (alternative to trainer name) |
| `member` | User | ❌ | Discord member to link (defaults to yourself) |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, check Manage Guild permission,
          require trainer or trainer_id)
  │
  ▼
Coordinator
  │
  └── Umamoe (verify trainer on Uma.moe, persist link record)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Creates a persistent mapping between the Discord user and their Uma.moe trainer account.
- Accepts either `trainer` (name) or `trainer_id` (numeric ID) — `trainer_id` takes priority if both are supplied.
- Required before the bot can show fan gain stats for that member.
- If the member is already linked, the existing link is overwritten with the new trainer.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to link members." |
| Neither `trainer` nor `trainer_id` provided | Ephemeral: "Please provide a `trainer` name or `trainer_id`." |
| Trainer not found on Uma.moe | Ephemeral: "Trainer not found on Uma.moe. Check the name or ID and try again." |
| Database write failure | Ephemeral: "Could not save the link right now. Please try again shortly." |

---

## Example

```
/link trainer:SmartFalcon
/link trainer:SmartFalcon member:@Trainer
/link trainer_id:974470619
/link trainer_id:974470619 member:@Trainer circle:UmaKraft
```
