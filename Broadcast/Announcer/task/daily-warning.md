# Task: Daily Warning

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Alert a circle when their cumulative daily fan total is below the daily goal threshold
at the end of the fan-gain window. Fires once per day per circle when the deficit
condition is met.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `0 * * * *` |
| Interval | Every hour |
| Effective fire | Announcer delivers when Archive-Inspector confirms the day's tally is closed and the deficit threshold is crossed |

Broker runs every hour. Archive-Inspector rejects all ticks until the daily tally window
closes and the fan total is confirmed below goal. Only then does the notification proceed.

---

## Registration

```javascript
schedule('daily-warning', '0 * * * *', (client) => broker.run('dailyWarning', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — circle daily fan total for today
Inspector checks:
  1. Tally window closed for today?
  2. Fan total < daily goal?
  3. No existing Archive record for notificationKey "daily-warning:{circleId}:{date}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

---

## Notification Key Format

```
daily-warning:{circleId}:{YYYY-MM-DD}
```

Example: `daily-warning:circle-001:2026-07-22`

---

## Payload

```json
{
  "type": "dailyWarning",
  "variant": 12,
  "fanTotal": 842000,
  "goal": 1000000,
  "deficit": 158000,
  "message": "Daily fan goal not reached. Total: 842,000 / 1,000,000.",
  "imageParams": {
    "type": "dailyWarning",
    "fanTotal": 842000,
    "goal": 1000000,
    "deficit": 158000
  }
}
```

---

## Recipients

| Target | Source |
|--------|--------|
| Channel | Circle's configured notification channel |
| Member DMs | All active members of the circle |
| Leader DM | Circle leader (if configured) |

---

## Delivery Steps (Announcer)

1. Check `channelSent` flag — if 0, render card via Fabricator → post to channel
2. Check `dmMemberSent` flag — if 0, DM each member in `recipients.memberDms`
3. Check `dmLeaderSent` flag — if 0, DM the circle leader

Each step updates its Archive flag on success. Failed steps are retried on the next
Broker tick via Archive-Transporter.

---

## Failure / Retry

If delivery is interrupted mid-way (bot crash, Discord outage), Broker's restart-recovery
path reads `Archive.getIncomplete()` on next startup and routes the record to
Archive-Transporter → Announcer. Only incomplete steps are retried; completed steps are
skipped (flag = 1).

---

## See Also

- `Broadcast/Broker/Broker.md` — fetch logic
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
