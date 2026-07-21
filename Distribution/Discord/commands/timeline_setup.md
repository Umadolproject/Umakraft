# /timeline_setup

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Configure the channel where automatic timeline posts are delivered.

---

## Permissions

🔒 Requires **Manage Guild**.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `channel_name` | String | ❌ | Name of the channel to use for timeline posts (defaults to `uma-timeline`) |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate Manage Guild permission)
  │
  ▼
Coordinator
  │
  └── Umamoe (create channel if absent, persist timelineChannelId in guild config)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Creates the channel if it does not already exist, then saves the channel ID as `timelineChannelId` in the guild config.
- The automatic timeline scheduler will post to this channel going forward.
- Re-running the command with a different `channel_name` updates the configured channel.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Manage Guild permission | Ephemeral: "You need the **Manage Guild** permission to use this command." |
| Bot lacks channel creation permission | Ephemeral: "I don't have permission to create channels. Please create the channel manually and try again, or grant me the **Manage Channels** permission." |
| Database write failure | Ephemeral: "Could not save the timeline channel configuration. Please try again shortly." |

---

## Example

```
/timeline_setup
/timeline_setup channel_name:uma-events
```
