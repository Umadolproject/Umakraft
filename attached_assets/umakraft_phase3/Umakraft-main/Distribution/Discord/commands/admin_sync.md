# /admin_sync

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Force an immediate data sync for all configured circles from Uma.moe, bypassing the normal hourly schedule.

---

## Permissions

🔒 Requires **Manage Guild**.

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
Commands (check Manage Guild permission)
  │
  ▼
Coordinator
  │
  └── Umamoe (trigger immediate sync for all configured circles)
        │
        ▼
Dispatcher (send ephemeral result embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Bypasses the normal hourly schedule and triggers a sync right away.
- Posts a result embed showing active member count, new members detected, and members who have left.
- Useful after circle roster changes or to verify data is up to date.
- Sync runs in-process; the response is sent after the sync completes.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to trigger a sync." |
| No circles configured | Ephemeral: "No circles are configured for this server." |
| Sync failure | Ephemeral: "The sync encountered an error: `{error message}`. Check `/circle_status` for details." |

---

## Example

```
/admin_sync
```
