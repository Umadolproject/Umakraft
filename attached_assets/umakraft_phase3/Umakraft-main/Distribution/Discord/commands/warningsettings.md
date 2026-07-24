# /warningsettings

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

View or update the warning engine configuration — thresholds and toggle settings — for this server.

---

## Permissions

🔒 Requires **Administrator**.

---

## Subcommands

| Subcommand | Description |
|------------|-------------|
| `view` | Show the current warning system settings |
| `set` | Update a single warning system setting |

---

## Options — `view`

None.

## Options — `set`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `key` | Choices | ✅ | Which setting to update (see setting keys below) |
| `value` | String | ✅ | New value — `true`/`false` for toggles, a number for thresholds |

### Setting Keys

| Key | Type | Description |
|-----|------|-------------|
| `enabled` | Boolean | Enable or disable the warning engine entirely |
| `reminder_threshold` | Integer | Fan gain % at which a reminder is sent (must be < `warning_threshold`) |
| `warning_threshold` | Integer | Fan gain % at which a warning is sent (must be > `reminder_threshold`, < `critical_threshold`) |
| `critical_threshold` | Integer | Fan gain % at which a critical alert is sent (must be > `warning_threshold`) |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate Administrator permission, validate subcommand,
          validate key and value types for `set`)
  │
  ▼
Coordinator
  │
  ├── [view] fetch warning config → Dispatcher
  └── [set]  validate threshold ordering → persist config → Dispatcher
```

---

## Behavior

- All replies are ephemeral (only visible to the user who ran it).
- **`view`:** Returns the current warning engine configuration as an embed.
- **`set`:** Updates one setting. Validates that threshold ordering is preserved — Reminder < Warning < Critical — and rejects configurations that violate this rule.
- Changes to settings take effect on the next warning engine run (every 30 minutes after the hourly data sync).

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Missing Administrator permission | Ephemeral: "You need the **Administrator** permission to use this command." |
| Invalid `key` | Ephemeral: "Unknown setting key `{key}`." |
| Invalid `value` type (e.g. non-numeric for threshold) | Ephemeral: "Invalid value for `{key}`. Expected a number between 1 and 100." |
| Threshold ordering violation | Ephemeral: "Invalid configuration: thresholds must satisfy Reminder < Warning < Critical." |
| Database write failure | Ephemeral: "Could not save the setting right now. Please try again shortly." |

---

## Example

```
/warningsettings view
/warningsettings set key:reminder_threshold value:80
/warningsettings set key:warning_threshold value:50
/warningsettings set key:enabled value:true
```
