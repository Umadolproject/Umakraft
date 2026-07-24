# Task: Milestone

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Congratulate an individual trainer when their cumulative monthly fan total crosses a
configured milestone tier. Fires per-trainer as soon as the milestone is confirmed in
Refinery/Depot, giving personal recognition within the circle's channel and via DM.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `*/10 * * * *` |
| Interval | Every 10 minutes |
| Effective fire | Announcer delivers on the first tick after Archive-Inspector confirms the trainer's fan total crossed a milestone threshold not yet recorded in Archive |

---

## Registration

```javascript
schedule('milestone', '*/10 * * * *', (client) => broker.run('milestone', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — per-trainer monthly fan total + tier config for the circle
Inspector checks:
  1. Does any trainer's monthly fan total meet or exceed an unannounced milestone tier?
  2. No existing Archive record for notificationKey "milestone:{circleId}:{trainerId}:{tier}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

Broker evaluates all trainers in the circle per tick. Archive-Inspector processes one
trainer-tier pair at a time; each gets its own Archive record and `notificationKey`.

---

## Notification Key Format

```
milestone:{circleId}:{trainerId}:{tierLabel}
```

Example: `milestone:circle-001:trainer-042:silver`

---

## Payload

```json
{
  "type": "milestone",
  "variant": 7,
  "trainerId": "trainer-042",
  "trainerName": "Hana",
  "tier": "silver",
  "fanTotal": 2000000,
  "threshold": 2000000,
  "month": "2026-07",
  "message": "Hana reached Silver milestone this month! Total: 2,000,000 fans.",
  "imageParams": {
    "type": "milestone",
    "trainerName": "Hana",
    "tier": "silver",
    "fanTotal": 2000000,
    "threshold": 2000000
  }
}
```

---

## Recipients

| Target | Source |
|--------|--------|
| Channel | Circle's configured notification channel |
| Member DMs | The specific trainer's linked Discord user only |
| Leader DM | Circle leader (if configured) |

---

## Delivery Steps (Announcer)

1. Check `channelSent` flag — if 0, render card via Fabricator → post to channel
2. Check `dmMemberSent` flag — if 0, DM the trainer (single user in `recipients.memberDms`)
3. Check `dmLeaderSent` flag — if 0, DM the circle leader

Each step updates its Archive flag on success. Failed steps are retried on the next
Broker tick via Archive-Transporter.

---

## Failure / Retry

If delivery is interrupted, Broker's restart-recovery reads `Archive.getIncomplete()` on
next startup and routes incomplete records to Archive-Transporter → Announcer. Only
unfinished steps are retried; completed steps (flag = 1) are skipped.

---

## See Also

- `Broadcast/Broker/Broker.md` — fetch logic and per-trainer iteration
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
