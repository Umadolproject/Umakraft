# Archive-Transporter

## Purpose

The **Archive-Transporter** is the fetch-and-handoff stage of the Broadcast pipeline.

It sits between Archive and Announcer. When Archive-Inspector approves a notification
and writes its record to Archive, it signals Archive-Transporter with the
`notificationKey`. Archive-Transporter reads the full record from Archive — including
all `imageParams` needed for fabrication — and passes it to Announcer to begin delivery.

On bot restart, Broker also routes incomplete `notificationKey` values through
Archive-Transporter instead of calling Announcer directly. This means every path into
Announcer is pre-loaded with the full Archive record by Archive-Transporter.

Archive-Transporter never evaluates eligibility, writes to Archive, selects variants,
or renders content. It only fetches and forwards.

---

## Responsibilities

1. **Receive the notificationKey** — from Archive-Inspector (new delivery) or from
   Broker (restart recovery for incomplete records).

2. **Fetch the full record from Archive** — call `Archive.get(notificationKey)` to
   retrieve the complete notification record: delivery plan, recipients, payload, image
   parameters, and current flag states.

3. **Validate the record** — confirm the record exists and is well-formed. If Archive
   returns nothing (record missing or corrupted), log the error and abort — do not call
   Announcer with an empty payload.

4. **Hand off to Announcer** — pass the full record (not just the key) to
   `Announcer.deliver(record, client)`. Announcer receives everything it needs for
   fabrication and delivery without making its own Archive read.

---

## Input

A `notificationKey` string, arriving from either Archive-Inspector or Broker:

```javascript
// From Archive-Inspector (new delivery)
await archiveTransporter.fetch(notificationKey, client)

// From Broker on restart recovery
await archiveTransporter.fetch(notificationKey, client)
```

Both callers use the same interface — Archive-Transporter does not distinguish between
a new notification and a restart-recovery retry.

---

## Output

The full notification record, passed directly to Announcer:

```json
{
  "notificationKey": "daily-warning:circle-001:2026-07-19",
  "type": "dailyWarning",
  "circleId": "circle-001",
  "claimedAt": "2026-07-19T23:45:01.000Z",
  "channelSent": 0,
  "dmMemberSent": 0,
  "dmLeaderSent": 0,
  "recipients": {
    "channels": ["channel-id-1"],
    "memberDms": ["viewer-id-1", "viewer-id-2"],
    "leaderDm": null
  },
  "payload": {
    "variant": 12,
    "fanTotal": 842000,
    "goal": 1000000,
    "message": "Your daily fan gain did not reach the goal...",
    "imageParams": { "type": "dailyWarning", "fanTotal": 842000, "goal": 1000000 }
  }
}
```

Announcer uses `payload.imageParams` to request rendering from `Workshop/Fabricator`,
and uses `recipients` and the delivery flags to execute each step.

---

## Failure Handling

If `Archive.get(notificationKey)` returns null or throws:

- Log the error with the `notificationKey`.
- Do **not** call Announcer.
- Return — no retry is initiated. The record either does not exist (bug upstream in
  Archive-Inspector) or is corrupted. Both are programming errors, not transient failures.

If the record is returned but `payload.imageParams` is missing or malformed:

- Log a warning with the `notificationKey` and the missing field.
- Do **not** call Announcer.
- Return. Announcer must never be called with incomplete fabrication data.

---

## Interface

```javascript
// Fetch a record from Archive and hand it off to Announcer.
// Called by Archive-Inspector (new) and Broker (restart recovery).
await archiveTransporter.fetch(notificationKey, client)

// Internal
const record = await archive.get(notificationKey)
await announcer.deliver(record, client)
```

---

## Workflow

```text
Archive-Inspector writes record → signals Archive-Transporter
                              OR
Broker reads Archive.getIncomplete() → signals Archive-Transporter (restart recovery)

     │
     ▼
ArchiveTransporter.fetch(notificationKey, client)
     │
     ├── record = Archive.get(notificationKey)
     │
     ├── record missing or malformed?
     │     → log error, return (do not call Announcer)
     │
     └── Announcer.deliver(record, client)
```

---

## Design Principle

Archive-Transporter owns the boundary between storage and delivery.

By isolating the Archive read into its own stage, Announcer becomes purely a delivery
engine — it receives a fully-loaded record and executes without any storage calls at
the start. Announcer still writes back to Archive (flag updates, history rows), but it
never needs to read a record itself. This makes Announcer independently testable with
any record handed to it directly, and keeps the data-fetch concern out of the
delivery logic.

Archive-Transporter is also the single entry point for Announcer — whether a
notification is new or being retried after a restart, Announcer always receives its
record via Archive-Transporter.

---

## Version History

- `v1.0` — Initial Archive-Transporter specification; introduced as the fetch-and-handoff
  stage between Archive and Announcer; replaces the direct notificationKey pass that
  Archive-Inspector and Broker previously made to Announcer
