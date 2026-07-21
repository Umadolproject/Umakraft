# /circle_status

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show the live sync status for all configured circles — last sync time and consecutive failure count.

---

## Permissions

None — available to all members.

---

## Options

None.

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (no validation required)
  │
  ▼
Coordinator
  │
  └── Umamoe (read sync state for each configured circle)
        │
        ▼
Dispatcher (send ephemeral embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Displays the last sync time for each circle and the number of consecutive sync failures, if any.
- Useful for quickly checking whether the bot's data is current without running a full sync.
- Does not trigger a sync — read-only status check.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| No circles configured | Ephemeral: "No circles are configured for this server." |
| Internal state unavailable | Ephemeral: "Circle status information is temporarily unavailable." |

---

## Example

```
/circle_status
```
