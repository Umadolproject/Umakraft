# /admin_syncCards

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Trigger a full sync of support card data from GameTora, reloading the in-memory card cache.

---

## Permissions

🔒 Requires **Administrator**.

---

## Options

None.

---

## Output

Ephemeral embed with live progress updates — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (check Administrator permission)
  │
  ▼
Coordinator
  │
  └── Umamoe (run card scraper against GameTora, reload cardCache)
        │
        ▼
Dispatcher (send ephemeral progress updates + final result embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Runs the card scraper in-process and reloads the in-memory `cardCache`.
- Posts live progress updates during the sync so you can track status.
- Use when new support cards have been released and need to be imported into the database.
- Sync duration depends on the number of cards to fetch; may take 30–120 seconds.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Administrator permission | Ephemeral: "You need the **Administrator** permission to use this command." |
| GameTora unreachable | Ephemeral: "Could not reach GameTora. Check connectivity and try again." |
| Scraper error | Ephemeral: "The card sync encountered an error: `{error message}`." |

---

## Example

```
/admin_syncCards
```
