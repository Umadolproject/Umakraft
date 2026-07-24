# Task: Leaderboard

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Post a compiled fan-gain leaderboard to the circle channel at the end of the daily and
weekly tally windows. Announces the top trainers ranked by fan gain for the period,
with personal DMs to top-3 finishers.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `0 * * * *` |
| Interval | Every hour |
| Effective fire | Announcer delivers when Archive-Inspector confirms the tally window is closed and the compiled leaderboard snapshot is available |

Broker runs hourly. Archive-Inspector rejects all ticks until the tally window closes
and a compiled leaderboard snapshot exists in Refinery/Depot. Dedup prevents re-posting
the same leaderboard on subsequent ticks.

---

## Registration

```javascript
schedule('leaderboard', '0 * * * *', (client) => broker.run('leaderboard', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — compiled leaderboard snapshot for today / this week
Inspector checks:
  1. Tally window (daily or weekly) closed?
  2. Compiled snapshot available with at least one ranked entry?
  3. No existing Archive record for notificationKey "leaderboard:{circleId}:{period}:{date}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

---

## Notification Key Format

```
leaderboard:{circleId}:{period}:{YYYY-MM-DD}
```

Examples:
- `leaderboard:circle-001:daily:2026-07-22`
- `leaderboard:circle-001:weekly:2026-07-20`  ← week-start date

---

## Payload

```json
{
  "type": "leaderboard",
  "variant": 2,
  "period": "daily",
  "date": "2026-07-22",
  "rankings": [
    { "rank": 1, "trainerId": "trainer-007", "trainerName": "Sora", "fanGain": 12400 },
    { "rank": 2, "trainerId": "trainer-042", "trainerName": "Hana", "fanGain": 9800 },
    { "rank": 3, "trainerId": "trainer-015", "trainerName": "Rin",  "fanGain": 8100 }
  ],
  "message": "Daily leaderboard is in! Top trainer: Sora with +12,400 fans.",
  "imageParams": {
    "type": "leaderboard",
    "period": "daily",
    "rankings": [ ... ]
  }
}
```

---

## Recipients

| Target | Source |
|--------|--------|
| Channel | Circle's configured notification channel |
| Member DMs | Top-3 ranked trainers' linked Discord users |
| Leader DM | Circle leader (if configured) |

---

## Delivery Steps (Announcer)

1. Check `channelSent` flag — if 0, render leaderboard card via Fabricator → post to channel
2. Check `dmMemberSent` flag — if 0, DM each of the top-3 trainers in `recipients.memberDms`
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

- `Broadcast/Broker/Broker.md` — fetch logic and snapshot reference
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
