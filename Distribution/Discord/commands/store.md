# /store

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Save your trainer card to the database for tracking and display.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `trainer` | String | ❌ | Uma.moe trainer name to store (defaults to your linked trainer) |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate input, resolve linked trainer if not provided)
  │
  ▼
Coordinator
  │
  └── Umamoe (fetch and persist trainer card data)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Fetches the trainer card from Uma.moe and saves it to the bot database.
- Reply is ephemeral (only visible to the user who ran it).
- If `trainer` is not specified, uses the trainer name linked to the calling member.
- Stored cards expire after 72 hours unless marked permanent with `/keep`.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Member is not linked and no trainer provided | Ephemeral: "You are not linked to a trainer. Provide a `trainer` name or use `/link` first." |
| Trainer name not found on Uma.moe | Ephemeral: "Trainer not found on Uma.moe. Check the name and try again." |
| Database write failure | Ephemeral: "Could not save the trainer card right now. Please try again shortly." |

---

## Example

```
/store
/store trainer:SmartFalcon
```
