# Coordinator

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Coordinator
**Last Updated:** 2026-07-21

---

## Purpose

The **Coordinator** department is the case manager of the Distribution stage.

It receives validated command payloads from Commands, orchestrates the necessary pipeline calls across Umamoe, Refinery, and Workshop, and produces a finished deliverable ready for the Dispatcher to deliver.

The Coordinator is the only department in Distribution that communicates with upstream pipeline stages.

---

## Responsibilities

* Receive validated command payloads from Commands.
* Determine which pipeline stages are required for each command.
* Call Umamoe to acquire raw data.
* Pass data through Refinery for transformation and compilation.
* Request deliverable construction from Workshop.
* Retrieve the finished deliverable from Workshop/Terminal.
* Handle pipeline errors, timeouts, and retries.
* Pass finished deliverables to the Dispatcher.

---

## Does Not Do

The Coordinator department must **never**:

* Receive Discord events directly — Commands is the sole entry point.
* Deliver responses to Discord — that belongs to Dispatcher.
* Construct Discord embeds or image payloads.
* Validate Discord command input — that belongs to Commands.
* Persist data outside of coordinating a single request lifecycle.
* Contain rendering or visual logic.

---

## Input

* Validated command payload from Commands.

## Output

* Finished deliverable passed to Dispatcher.
* Structured error envelope when pipeline execution fails.

---

## Workflow

```text
Validated Command Payload (from Commands)
            │
            ▼
        Coordinator
            │
            ▼
          Umamoe
      (acquire raw data)
            │
            ▼
         Refinery
      (transform & compile)
            │
            ▼
         Workshop
      (render deliverable)
            │
            ▼
    Workshop / Terminal
     (pick up deliverable)
            │
            ▼
        Dispatcher
```

---

## Error Handling

* On pipeline failure, produce a structured error envelope describing which stage failed and whether the error is retriable.
* Do not surface raw pipeline errors to Discord — pass the error envelope to Dispatcher for user-friendly formatting.
* Do not silently swallow failures — every failure must be logged and communicated downstream.

---

## Design Principle

The Coordinator owns **orchestration**, not implementation.

It knows *which* pipeline stages to call and *in what order*, but it does not contain the logic of those stages. If business logic is appearing inside the Coordinator, it belongs in Refinery. If rendering logic is appearing, it belongs in Workshop.

One command → one Coordinator action → one deliverable.
