# Task: Greeting

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Send a personalised daily greeting to each active circle member at the start of their
local morning. Fires once per member per day, timezone-aware, so members in different
regions receive their greeting at the appropriate local time.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `0 * * * *` |
| Interval | Every hour |
| Effective fire | Announcer delivers once per member when Archive-Inspector confirms it is morning in the member's timezone and no greeting has been sent today |

Broker runs hourly. Archive-Inspector evaluates each member's timezone and fires when
the current UTC time corresponds to morning local time for that member. Dedup prevents
a second greeting if the bot restarts mid-day.

---

## Registration

```javascript
schedule('greeting', '0 * * * *', (client) => broker.run('greeting', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — member roster with linked status + timezone for the circle
Inspector checks per member:
  1. Member is active and linked?
  2. Current UTC time falls within the member's morning window (timezone-aware)?
  3. No existing Archive record for notificationKey "greeting:{circleId}:{memberId}:{date}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

Each member-day gets its own Archive record and `notificationKey`.

---

## Notification Key Format

```
greeting:{circleId}:{memberId}:{YYYY-MM-DD}
```

Example: `greeting:circle-001:member-023:2026-07-22`

---

## Payload

```json
{
  "type": "greeting",
  "variant": 5,
  "memberId": "member-023",
  "memberName": "Yuki",
  "timezone": "Asia/Tokyo",
  "message": "Good morning, Yuki! Ready for today's fan push?",
  "imageParams": {
    "type": "greeting",
    "memberName": "Yuki"
  }
}
```

---

## Recipients

| Target | Source |
|--------|--------|
| Channel | `null` — greetings are DM-only; no channel post |
| Member DMs | The specific member's linked Discord user |
| Leader DM | `null` — not applicable for individual greetings |

`channelSent` is marked as done immediately (no channel configured). Only `dmMemberSent`
represents meaningful delivery state for this notification type.

---

## Delivery Steps (Announcer)

1. `channelSent` — no channel configured; Archive-Inspector sets this to 1 at write time
2. Check `dmMemberSent` flag — if 0, DM the member
3. `dmLeaderSent` — not applicable; Archive-Inspector sets this to 1 at write time

Each step updates its Archive flag on success. Failed DMs are retried on the next
Broker tick via Archive-Transporter.

---

## Failure / Retry

If the DM fails (member has DMs closed, Discord outage), Announcer leaves `dmMemberSent`
at 0 and logs the Discord error code. On the next Broker tick, restart-recovery
surfaces the record via `Archive.getIncomplete()` → Archive-Transporter → Announcer.

Greeetings that are not delivered by end-of-day are not silently dropped — they remain in
Archive as incomplete until the delivery flag is marked 1 or a TTL policy is applied.

---

## See Also

- `Broadcast/Broker/Broker.md` — member roster fetch and per-member iteration
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
