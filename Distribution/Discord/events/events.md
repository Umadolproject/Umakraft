# Events

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Discord → Events
**Last Updated:** 2026-07-21

---

## Purpose

The **Events** directory contains one file per Discord gateway event that the bot listens to.

Each event file receives the raw event payload from the Discord API and forwards it to the appropriate Commands handler. No business logic or pipeline calls live here — only the raw event binding.

---

## Responsibilities

* Listen for and receive Discord gateway events.
* Extract the relevant payload from each event.
* Forward the payload to the correct Commands handler.
* Handle event registration with the Discord client on startup.

---

## Does Not Do

* Validate command input — that belongs to Commands.
* Orchestrate pipeline calls — that belongs to Coordinator.
* Deliver responses — that belongs to Dispatcher.
* Contain any logic beyond receiving and forwarding the event.

---

## Event Files

Each file in this directory corresponds to one Discord gateway event.

| File | Event | Forwards To |
|------|-------|-------------|
| `interactionCreate.js` | Slash command interaction received | Commands |
| `ready.js` | Bot connected and ready | Commands (startup routing) |
| `guildMemberAdd.js` | New member joins a guild | Commands |
| `messageCreate.js` | Message posted in a channel | Commands |
| `presenceUpdate.js` | Member presence changes | Commands |

---

## Design Principle

Event handlers are **wires, not workers**.

They receive a signal from Discord and pass it on. Nothing more. If logic is growing inside an event handler, it belongs in Commands.
