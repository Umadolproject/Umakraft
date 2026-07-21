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

Save your trainer card to the bot database by trainer ID, scraping support card skill data from Uma.moe and rendering a confirmation image.

---

## Permissions

None — available to all members.

> ⚠️ Reply is restricted to the designated trainer card channel (e.g. `#uma-store`). Using the command in any other channel returns an ephemeral error.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `trainer_id` | String | ✅ | Your Uma.moe trainer ID (numeric — found in your Uma.moe profile URL) |

---

## Output

Ephemeral embed — confirmation message visible only to the user who ran the command, followed by a rendered summary image of the stored card data.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate trainer_id is numeric, check channel restriction)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch trainer card data from Uma.moe by trainer_id)
  │
  ├── Workshop (render trainer card summary image)
  │
  └── Database (store trainer card record with 72-hour TTL)
        │
        ▼
Dispatcher (send ephemeral confirmation embed + rendered card image)
```

---

## Behavior

- Reply is ephemeral — only visible to the user who ran the command.
- Reply is restricted to the designated trainer card channel. If used elsewhere, returns an ephemeral error.
- Scrapes the trainer's support card skills from Uma.moe using the provided `trainer_id`.
- Renders and posts a confirmation image summarising the stored card data (skills, rank, card name).
- Stores the result in the trainer card database with a **72-hour expiry**.
- If a card for the same `trainer_id` already exists in the database, the existing entry is overwritten with fresh data.
- To prevent automatic expiry, mark the card permanent with `/keep trainer_id:<id>` after storing.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| `trainer_id` not numeric | Ephemeral: "Invalid trainer ID. The ID must be a numeric value (e.g. `974470619`)." |
| Command used in wrong channel | Ephemeral: "This command can only be used in #uma-store." |
| Trainer not found on Uma.moe | Ephemeral: "Trainer ID `{id}` was not found on Uma.moe. Check the ID and try again." |
| Uma.moe fetch failure | Ephemeral: "Could not retrieve card data from Uma.moe right now. Please try again shortly." |
| Render failure | Ephemeral: "The card image could not be generated. The data has been stored — try `/search_trainer` to verify." |
| Database write failure | Ephemeral: "Could not save the card right now. Please try again shortly." |

---

## Example

```
/store trainer_id:974470619
```

After storing:
```
/keep trainer_id:974470619
```
