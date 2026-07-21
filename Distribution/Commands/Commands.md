# Commands

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Commands
**Last Updated:** 2026-07-21

---

## Purpose

The **Commands** department is the front desk of the Distribution stage.

It receives every incoming Discord slash command, validates the user's input, and maps the request to the appropriate Coordinator action. It is the sole entry point for all user-triggered interactions within the pipeline.

Commands does not process, orchestrate, or respond. It receives, validates, and routes.

---

## Responsibilities

* Receive Discord slash command events.
* Validate command options and required parameters.
* Reject malformed or unauthorized input before it enters the pipeline.
* Map each slash command to the correct Coordinator action.
* Pass validated input downstream to the Coordinator.
* Return early user-facing errors when validation fails (e.g. missing required options, invalid format).

---

## Does Not Do

The Commands department must **never**:

* Call Umamoe, Refinery, or Workshop directly.
* Orchestrate pipeline execution or manage pipeline state.
* Construct Discord embeds, images, or message payloads.
* Deliver responses to Discord — that belongs to Dispatcher.
* Contain business logic or data transformations.
* Persist any data.

---

## Input

* Discord slash command interaction event.

## Output

* Validated command payload routed to Coordinator.
* Early error reply to Discord when validation fails.

---

## Workflow

```text
Discord Slash Command Event
            │
            ▼
        Commands
     (validate input)
            │
     ┌──────┴──────┐
     │             │
  Invalid        Valid
     │             │
     ▼             ▼
Error Reply    Coordinator
 to Discord
```

---

## Design Principle

Commands is intentionally **thin**.

Its only job is to be the clean boundary between Discord and the rest of the pipeline. Every slash command has exactly one handler here. Handlers contain no business logic — only validation, permission checks, and routing.

If logic is growing inside a command handler, it belongs in the Coordinator, not here.
