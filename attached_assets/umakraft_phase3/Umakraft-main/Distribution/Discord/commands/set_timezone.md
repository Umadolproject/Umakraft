# /set_timezone

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Set your personal timezone so greeting messages arrive at the right local time.

---

## Permissions

None — available to all members.

---

## Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `timezone` | String | ✅ | Your timezone — supports autocomplete; accepts abbreviations (e.g. `JST`) or IANA names (e.g. `Asia/Tokyo`) |

---

## Output

Ephemeral embed — visible only to the user who ran the command.

---

## Pipeline Route

```text
Discord
  │
  ▼
Commands (validate timezone string, resolve abbreviations to IANA)
  │
  ▼
Coordinator
  │
  └── Umamoe (persist timezone preference for member)
        │
        ▼
Dispatcher (send ephemeral confirmation embed)
```

---

## Behavior

- Reply is ephemeral (only visible to the user who ran it).
- Accepts IANA timezone names (e.g. `Asia/Tokyo`) and common abbreviations (e.g. `JST`, `UTC+9`).
- Stored timezone is used by the greeting engine to send messages at the correct local time.
- Setting a new timezone overwrites the previous preference.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Unrecognized timezone string | Ephemeral: "Timezone `{value}` was not recognized. Use an IANA name (e.g. `Asia/Tokyo`) or a common abbreviation (e.g. `JST`)." |
| Database write failure | Ephemeral: "Could not save your timezone right now. Please try again shortly." |

---

## Example

```
/set_timezone timezone:JST
/set_timezone timezone:Asia/Tokyo
/set_timezone timezone:UTC+9
```
