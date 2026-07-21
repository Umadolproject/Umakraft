# Discord

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Discord
**Last Updated:** 2026-07-21

---

## Purpose

The **Discord** department is the platform layer of the Distribution stage.

It owns the raw Discord API surface — every file that originates directly from Discord or is registered directly with the Discord API lives here. It is the boundary between the Discord platform and the rest of the pipeline.

Discord does not process, orchestrate, or deliver. It exposes incoming events and slash command definitions to Commands, and provides shared Discord utilities to Dispatcher.

---

## Responsibilities

* Define and register all Discord slash commands with the Discord API.
* Handle all raw Discord gateway events (e.g. `interactionCreate`, `ready`, `guildMemberAdd`).
* Forward interaction events to the Commands department for validation and routing.
* Provide shared Discord platform utilities (permission helpers, embed builders, rate-limit guards) consumed by Commands and Dispatcher.
* Maintain a single, authoritative list of all registered slash commands.

---

## Does Not Do

The Discord department must **never**:

* Validate business rules or command logic — that belongs to Commands.
* Orchestrate pipeline stages — that belongs to Coordinator.
* Construct final deliverable content — that belongs to Workshop.
* Deliver completed responses to Discord — that belongs to Dispatcher.
* Persist any data.
* Contain business logic of any kind.

---

## Input

* Raw Discord gateway events received from the Discord API.

## Output

* Forwarded interaction events passed to Commands.
* Slash command definitions registered with the Discord API.
* Shared Discord utilities available to Commands and Dispatcher.

---

## Structure

```text
Discord/
├── commands/     — slash command definitions and registrations
├── events/       — raw Discord gateway event handlers
└── Discord.md    — this document
```

### `commands/`

Contains one file per slash command definition. Each file declares the command name, description, and options that are registered with the Discord API. No handler logic lives here — only the definition.

### `events/`

Contains one file per Discord gateway event. Each event file receives the raw Discord event payload and forwards it to the appropriate Commands handler. No business logic lives here.

---

## Workflow

```text
Discord API
     │
     ├── Gateway Events ──────────────► events/
     │                                      │
     │                                      ▼
     │                                  Commands
     │
     └── Slash Command Registration ◄── commands/
```

---

## Design Principle

Discord is a **platform adapter**, not a pipeline stage.

It exists to keep all Discord-specific API concerns in one place so that Commands and Dispatcher remain platform-agnostic in their logic. If a file's primary reason for existing is because Discord requires it — a command definition, a gateway event handler, a permission utility — it belongs here. If a file exists to process what Discord delivers, it belongs in Commands.
