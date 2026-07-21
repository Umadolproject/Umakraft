# /status

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Show live bot health, sync status, and uptime.

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
  └── Umamoe (read internal health metrics and sync state)
        │
        ▼
Dispatcher (send ephemeral embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Displays: bot uptime, last successful sync time, next scheduled sync, active circle count, and any recent sync errors.
- Does not trigger a sync — read-only status check.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Internal state unavailable | Ephemeral: "Status information is temporarily unavailable." |

---

## Example

```
/status
```
