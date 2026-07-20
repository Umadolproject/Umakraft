# Archive-Inspector

## Purpose

The **Archive-Inspector** is the decision-maker of the Broadcast pipeline and the sole
department that creates records in Archive.

Archive-Inspector receives raw Refinery data from Broker, runs every check, and either
approves the notification (writing the full record to Archive and signalling
Archive-Transporter) or rejects it cleanly so nothing is ever written anywhere.

---

## Responsibilities

1. **Eligibility check** — does the data from Broker actually meet the notification
   threshold? Is the grace period over? Is the tally window still open? Is the
   escalation level higher than the last DM'd level?
   Archive-Inspector reads pre-computed values from the raw data Broker fetched — it does
   not re-fetch from Refinery and does not re-implement business logic.

2. **Dedup check** — does an Archive record for this `notificationKey` already exist?
   If yes, this notification has already been approved and claimed. Archive-Inspector
   rejects the job immediately so no duplicate record is created.

3. **Recipient resolution** — determine the full delivery plan:
   which channel(s), which member DMs, whether a leader DM is required.

4. **Variant selection** — select one message variant from the pool, personalise
   text tokens per recipient where applicable, and determine image parameters
   for Archive-Transporter to pass to Announcer.

5. **Write to Archive** — if all checks pass, Archive-Inspector inserts the full
   notification record into Archive (claim + delivery plan + payload + all flags at 0).

6. **Signal Archive-Transporter** — after a successful Archive write, Archive-Inspector
   passes the `notificationKey` to Archive-Transporter to begin the fetch-and-deliver
   handoff to Announcer.

Archive-Inspector is the **only** department that creates new records in Archive.

---

## Decision Flow

```text
Broker passes raw input envelope
     │
     ▼
1. eligibility check      fail → reject, log reason, return
     │ pass
     ▼
2. dedup check            fail → reject (already claimed), return
     │ pass
     ▼
3. recipient resolution   fail → reject (no recipients), return
     │ pass
     ▼
4. variant selection
     │
     ▼
5. write full record to Archive
     │
     ▼
6. pass notificationKey to Archive-Transporter
```

If any step fails, Archive-Inspector stops immediately. No partial writes, no side effects.

---

## Input

Raw notification input envelope from Broker:

```json
{
  "type": "dailyWarning",
  "circleId": "circle-001",
  "fetchedAt": "2026-07-19T23:45:00.000Z",
  "data": {
    "fanTotal": 842000,
    "memberStats": [ ... ],
    "snapshotDate": "2026-07-19",
    "depotRef": "depot-product-id-xyz"
  }
}
```

---

## Output

### Approved — Archive record written + Archive-Transporter signalled

Archive record written by Archive-Inspector:

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
    "message": "...",
    "imageParams": { "type": "dailyWarning", "fanTotal": 842000, "goal": 1000000 }
  }
}
```

### Rejected — nothing written, reason logged

```json
{
  "accepted": false,
  "notificationKey": "daily-warning:circle-001:2026-07-19",
  "reason": "THRESHOLD_NOT_MET | DEDUP_EXISTS | GRACE_PERIOD | TALLY_CLOSED | NO_RECIPIENTS"
}
```

---

## Notification Key Format

Every notification has a stable, deterministic `notificationKey` used as Archive's
primary key. Archive-Inspector computes this key before the dedup check.

| Notification type | Key format |
|---|---|
| Milestone | `milestone:{circleId}:{viewerId}:{tierKey}:{YYYY-MM}` |
| Daily warning | `daily-warning:{circleId}:{YYYY-MM-DD}` |
| Weekly warning | `weekly-warning:{circleId}:{YYYY-Www}` |
| Monthly warning | `monthly-warning:{circleId}:{YYYY-MM}` |
| Achievement tier | `achievement:{circleId}:{tierKey}:{YYYY-MM-DD}` |
| Daily greeting (channel) | `greeting-channel:{circleId}:{YYYY-MM-DD}` |
| Member greeting (DM) | `greeting-member:{viewerId}:{greetingType}:{local-YYYY-MM-DD}` |
| Offline check | `offline:{viewerId}:{YYYY-MM-DD}` |
| Leaderboard | `leaderboard:{circleId}:{period}:{YYYY-MM-DD}` |
| Fan deficit | `fan-deficit:{circleId}:{YYYY-MM-DD}` |
| Inter-circle | `inter-circle:{YYYY-Www}` |

---

## Interface

```javascript
// Evaluate a raw input envelope from Broker; returns { accepted, notificationKey }
await archiveInspector.evaluate({ type, circleId, data, fetchedAt })

// Register eligibility + variant config for a notification type (called during setup)
archiveInspector.registerType(type, {
  buildKey,          // (circleId, data) => notificationKey
  checkEligibility,  // (data) => boolean
  resolveRecipients, // (data) => { channels, memberDms, leaderDm }
  selectVariant,     // (data) => { variant, message, imageParams }
})
```

---

## Workflow

```text
Broker (raw input envelope)
     │
     ▼
ArchiveInspector.evaluate(envelope)
  1. eligibility check   (data from Broker)
  2. dedup check         (Archive.exists(notificationKey))
  3. recipient resolution
  4. variant selection
  5. Archive.insert(full record)
  6. ArchiveTransporter.fetch(notificationKey, client)
```

---

## Design Principle

Archive-Inspector is the single point of approval for every notification.

It is the only department that may create an Archive record. Once Archive-Inspector writes
to Archive, the notification is committed — Archive-Transporter will fetch the record and
hand it to Announcer for delivery, and Broker will recover any incomplete steps on
restart. Before Archive-Inspector writes, nothing has happened and nothing needs to be
cleaned up.

This one-writer contract keeps Archive consistent: every record in Archive was
explicitly approved by Archive-Inspector, exactly once.

---

## Current Source Files

Logic extracted into Archive-Inspector from these files:

| Current file | Archive-Inspector responsibility |
|---|---|
| `fantracking/milestone/eval.js` | Eligibility — `meetsThreshold()` |
| `fantracking/milestone/tiers.js` | Variant pool — tier config, labels, colors |
| `fantracking/milestone/winners.js` | Recipient resolution — top-3 winner selection |
| `fantracking/warnings/engine.js` | Eligibility — pace calc, level escalation, grace period |
| `fantracking/warnings/daily.js` | Eligibility — daily fan goal threshold |
| `fantracking/warnings/weekly.js` | Eligibility — weekly goal threshold |
| `fantracking/warnings/monthly.js` | Eligibility — monthly goal threshold |
| `fantracking/milestone/cleanup.js` | Pruning trigger — coordinates with Archive |

---

## Version History

- `v1.0` — Initial Inspector specification
- `v1.1` — Inspector is now the sole writer to Archive; writes full record on approval
  and signals Announcer directly; dedup check queries Archive before any write
- `v1.2` — Renamed to Archive-Inspector; step 6 now signals Archive-Transporter instead
  of Announcer directly; Archive-Transporter owns the fetch-and-handoff to Announcer
