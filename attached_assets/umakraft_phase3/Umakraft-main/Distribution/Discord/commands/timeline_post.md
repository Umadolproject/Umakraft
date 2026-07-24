# /timeline_post

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Manually trigger a timeline post to the configured timeline channel.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `date` | String | ❌ | Date of the timeline entry to post in `YYYY-MM-DD` format (defaults to today) |

---

## Output

Public message posted to the configured timeline channel. Ephemeral confirmation to the caller.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate Manage Guild permission, validate date format if provided)
  │
  ▼
Coordinator
  │
  ├── Umamoe (fetch timeline event data for the specified date)
  │
  └── Dispatcher (post to timeline channel, send ephemeral confirmation to caller)
```

---

## Behavior

- Manually triggers a post to the timeline channel that was configured with `/timeline_setup`.
- Reply is ephemeral (only visible to the user who ran it).
- Defaults to today's date if `date` is not specified.
- Useful for re-posting a missed entry or testing timeline output.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to use this command." |
| Timeline channel not configured | Ephemeral: "No timeline channel is configured. Run `/timeline_setup` first." |
| Invalid date format | Ephemeral: "Invalid date format. Use `YYYY-MM-DD` (e.g. `2026-07-21`)." |
| No event data for the date | Ephemeral: "No timeline events found for that date." |
| Post delivery failure | Ephemeral: "Could not post to the timeline channel. Check that the bot has permission to send messages there." |

---

## Example

```
/timeline_post
/timeline_post date:2026-07-15
```
