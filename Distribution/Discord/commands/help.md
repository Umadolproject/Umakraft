# /help

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 4 — Distribution
**Department:** Discord → Commands (Definitions)
**Status:** Active
**Version:** v1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

Display an image card listing all available bot commands with brief descriptions.

---

## Permissions

None — available to all members.

---

## Options

None.

---

## Output

Image report — posted publicly in the channel.

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
  └── Workshop / Draftsman (render help blueprint)
        │
        ▼
Dispatcher (post image to channel)
```

---

## Behavior

- Renders and posts an image help card listing every command and a brief description.
- Visible to everyone in the channel.
- Does not require any data fetch — content is static from the help blueprint.

---

## Error Responses

| Condition | Response |
|-----------|----------|
| Render failure | Ephemeral: "Could not render the help card right now. Please try again shortly." |

---

## Example

```
/help
```
