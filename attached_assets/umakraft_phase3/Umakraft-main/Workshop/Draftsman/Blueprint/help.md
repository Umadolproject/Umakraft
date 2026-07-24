# Help Blueprint

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Stage:** 3 — Workshop
**Department:** Draftsman
**Status:** DEFINED
**Version:** 1.0.0
**Last Updated:** 2026-07-21

---

## Purpose

This blueprint defines the structure for the `/help` deliverable.

It describes how command usage guides and interactive help cards are rendered for Discord users.

---

## Product Overview

The `/help` response is a structured embed or image card listing available commands and their descriptions. When a specific command is provided, it returns an expanded card with usage details, parameters, and examples for that command.

---

## Command

```
/help
```

---

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `command` | String | No | — | Specific command name to show detailed help for |

---

## Permissions

- All members

---

## Layout

### Mode A — General (no command specified)

1. Header
   - Title: `Umakraft Commands`
   - Generated timestamp
2. Command list
   - One row per available command: name + short description
3. Footer
   - Tip: `Use /help command:<name> for details`

### Mode B — Specific command

1. Header
   - Command name
   - Short description
2. Parameters table
   - Name, type, required, default, description
3. Examples
   - Usage examples
4. Footer
   - Source attribution

---

## Data Contract

The blueprint expects:

- `meta`
  - `mode` — `general` or `specific`
  - `generatedAt`
- `commands` (Mode A only)
  - array of `{ name, description }`
- `command` (Mode B only)
  - `name`
  - `description`
  - `parameters`: array of `{ name, type, required, default, description }`
  - `examples`: array of strings

---

## Pipeline Ownership

| Stage | Department | Responsibility |
|-------|-----------|---------------|
| 2 — Refinery | Compiler | Assemble help product from static command registry |
| 2 — Refinery | Depot | Persist and serve compiled help product |
| 3 — Workshop | Draftsman | Own this blueprint |
| 3 — Workshop | Fabricator | Render help embed or card from compiled product |
| 3 — Workshop | Validator | Approve rendered deliverable before release |
| 4 — Distribution | Commands | Intake and validate `/help` interaction |
| 4 — Distribution | Coordinator | Retrieve compiled help product |
| 4 — Distribution | Dispatcher | Deliver embed to Discord |

---

## Error Handling

| Condition | Response |
|-----------|----------|
| Unknown command specified | `❌ Command not found. Use /help to see all available commands.` |
| Command registry empty | `❌ No commands available.` |

---

## Performance Requirements

- Response time under 1 second (static content — no live API calls).
- Command registry sourced from compiled product only.

---

## Workflow

```text
Discord User
      │
      ▼
   /help [command]
      │
      ▼
Commands — validate input
      │
      ▼
Coordinator — retrieve compiled help product from Depot
      │
      ▼
Workshop — Fabricator renders help embed using this blueprint
      │
      ▼
Dispatcher — deliver embed to Discord (ephemeral)
```

---

## Implementation Notes

- The command-to-blueprint mapping is maintained in `command-blueprints.json`.
- A plain-text CLI-friendly fallback must be provided alongside the embed.
- Help responses are ephemeral (visible to the requesting user only).
- Command list is sourced from the compiled product — never hardcoded in the renderer.

---

## Governance Compliance

- [x] Blueprint registered in `Workshop/Draftsman/Blueprint/`
- [x] Pipeline ownership assigned per stage
- [x] No department responsibility is duplicated
- [x] Pipeline direction is forward only
- [ ] ADR recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`
