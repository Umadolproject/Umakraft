# Dispatcher

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Dispatcher
**Last Updated:** 2026-07-21

---

## Purpose

The **Dispatcher** department is the delivery clerk of the Distribution stage.

It receives finished deliverables from the Coordinator and routes them to the correct Discord destination — whether that is a channel reply, a direct message, an ephemeral response, or an image attachment.

The Dispatcher is the only department in Distribution that communicates outward to Discord with a final response.

---

## Responsibilities

* Receive finished deliverables from the Coordinator.
* Determine the correct Discord destination (channel, DM, ephemeral reply, thread).
* Format the deliverable into the appropriate Discord payload (embed, image attachment, plain message).
* Send the response to Discord.
* Handle Discord API delivery errors (rate limits, unknown channel, missing permissions).
* Format user-facing error messages when the Coordinator passes an error envelope.

---

## Does Not Do

The Dispatcher department must **never**:

* Call Umamoe, Refinery, or Workshop directly.
* Orchestrate pipeline execution — that belongs to Coordinator.
* Receive Discord slash command events — that belongs to Commands.
* Construct business logic or transform data content.
* Persist deliverables — Workshop/Terminal is the staging area.
* Modify the content of a deliverable — only wrap it for Discord delivery.

---

## Input

* Finished deliverable from Coordinator.
* Structured error envelope from Coordinator (on pipeline failure).

## Output

* Discord message, embed, or image attachment delivered to the correct destination.
* User-facing error message when a pipeline failure envelope is received.

---

## Workflow

```text
Finished Deliverable (from Coordinator)
            │
            ┌──────────────────────┐
            │                      │
        Deliverable           Error Envelope
            │                      │
            ▼                      ▼
   Resolve Destination      Format Error Reply
            │                      │
            ▼                      │
  Format Discord Payload           │
            │                      │
            └──────────┬───────────┘
                       │
                       ▼
              Send to Discord
```

---

## Error Handling

* On Discord API failure (rate limit, permissions), log the error with full context and attempt one retry where safe.
* Do not silently drop failed deliveries — undeliverable responses must be logged with the original payload preserved for diagnostics.
* Never surface raw Discord API errors to the user — translate them into clear, user-friendly messages.

---

## Design Principle

The Dispatcher owns **delivery**, nothing else.

It does not decide what to say — the Coordinator and Workshop have already determined that. It only decides how and where to say it on Discord. If routing logic is growing complex, it is a sign the Coordinator is not providing enough context in its output envelope, not a sign that the Dispatcher should contain more logic.
