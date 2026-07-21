# Commands (Slash Command Definitions)

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Discord → Commands (Definitions)
**Last Updated:** 2026-07-21

---

## Purpose

The **commands/** directory contains the slash command definitions registered with the Discord API.

Each file declares a single slash command — its name, description, and options — in the format Discord requires for registration. No handler logic lives here. Command handling belongs to the Commands department.

---

## Responsibilities

* Declare slash command name, description, and options.
* Define option types, requirements, and choices where applicable.
* Serve as the authoritative source for what commands are registered with Discord.
* Be loaded by the Discord client at startup for bulk registration.

---

## Does Not Do

* Handle or process command interactions — that belongs to `Distribution/Commands/`.
* Validate user input — that belongs to `Distribution/Commands/`.
* Call pipeline stages — that belongs to `Distribution/Coordinator/`.
* Contain any runtime logic.

---

## Registered Commands

| Command | Description |
|---------|-------------|
| `/profile` | Render a trainer profile card |
| `/circle` | Render or inspect a circle summary |
| `/fan_gain` | Show recent fan gains for a trainer or circle |
| `/memberlist` | Show members of a circle or top contributors |
| `/link` | Provide canonical links and short preview |
| `/set_fans` | Admin: set or adjust a trainer's fan count |

---

## Design Principle

Definitions are **declarations, not implementations**.

A slash command definition tells Discord what the command looks like. It does not know what the command does. Keeping definitions here and handlers in `Distribution/Commands/` ensures Discord's registration requirements never bleed into pipeline logic.
