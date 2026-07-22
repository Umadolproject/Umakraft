# Task: Weekly Warning

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Alert a circle when their cumulative weekly fan total is below the weekly goal threshold
at the close of the weekly tally window. Fires once per week per circle when the deficit
condition is confirmed, giving the circle visibility on underperformance before the next
weekly cycle begins.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `0 9 * * 1` |
| Interval | Every Monday at 09:00 UTC |
| Effective fire | Announcer delivers when Archive-Inspector confirms the previous week's tally is closed and the fan total is below the weekly goal |

Broker fires once on Monday morning. Archive-Inspector checks the prior week's compiled
total against the configured weekly goal. If the total is at or above goal, it rejects
cleanly — no notification is written or delivered.

---

## Registration

```javascript
schedule('weekly-warning', '0 9 * * 1', (client) => broker.run('weeklyWarning', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — circle period totals for the completed week
Inspector checks:
  1. Weekly tally window closed (previous Monday–Sunday complete)?
  2. Fan total < weekly goal?
  3. No existing Archive record for notificationKey "weekly-warning:{circleId}:{weekStartDate}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

---

## Notification Key Format

```
weekly-warning:{circleId}:{YYYY-MM-DD}
```

`YYYY-MM-DD` is the Monday that started the completed week.

Example: `weekly-warning:circle-001:2026-07-13`

---

## Payload

```json
{
  "type": "weeklyWarning",
  "variant": 4,
  "weekStart": "2026-07-13",
  "weekEnd": "2026-07-19",
  "fanTotal": 5240000,
  "goal": 7000000,
  "deficit": 1760000,
  "message": "Weekly fan goal not reached. Total: 5,240,000 / 7,000,000 (−1,760,000).",
  "imageParams": {
    "type": "weeklyWarning",
    "weekStart": "2026-07-13",
    "weekEnd": "2026-07-19",
    "fanTotal": 5240000,
    "goal": 7000000,
    "deficit": 1760000
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

Because this task fires only once per week, the restart-recovery path is especially
important. If the bot crashes between delivery steps, Broker's `_recoverIncomplete()`
on next startup routes the record to Archive-Transporter → Announcer. Only the
unfinished steps are retried; completed steps (flag = 1) are skipped.

---

## See Also

- `Broadcast/Broker/Broker.md` — fetch logic and weekly tally reference
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
