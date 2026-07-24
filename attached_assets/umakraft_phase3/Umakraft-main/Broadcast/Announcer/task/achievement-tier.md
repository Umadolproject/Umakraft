# Task: Achievement Tier

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Announce when a circle's cumulative fan total crosses a configured achievement tier
threshold. Fires as soon as the threshold crossing is detected, giving members real-time
recognition of a milestone reached during the day.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `*/5 * * * *` |
| Interval | Every 5 minutes |
| Effective fire | Announcer delivers on the first tick after Archive-Inspector confirms the tier threshold was crossed and no prior record exists for that tier |

Broker polls frequently so tier crossings are announced quickly after the data is
available in Refinery/Depot. Archive-Inspector's dedup key prevents re-announcing the
same tier on subsequent ticks.

---

## Registration

```javascript
schedule('achievement-tier', '*/5 * * * *', (client) => broker.run('achievementTier', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — circle hourly fan total + tier thresholds
Inspector checks:
  1. Does the current fan total meet or exceed a tier threshold not yet announced?
  2. No existing Archive record for notificationKey "achievement-tier:{circleId}:{tier}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

---

## Notification Key Format

```
achievement-tier:{circleId}:{tierLabel}
```

Example: `achievement-tier:circle-001:gold`

---

## Payload

```json
{
  "type": "achievementTier",
  "variant": 3,
  "tier": "gold",
  "fanTotal": 5000000,
  "threshold": 5000000,
  "message": "Circle reached Gold tier! Total fans: 5,000,000.",
  "imageParams": {
    "type": "achievementTier",
    "tier": "gold",
    "fanTotal": 5000000,
    "threshold": 5000000
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

If delivery is interrupted, Broker's restart-recovery reads `Archive.getIncomplete()` on
next startup and routes incomplete records to Archive-Transporter → Announcer. Only
unfinished steps are retried; completed steps (flag = 1) are skipped.

---

## See Also

- `Broadcast/Broker/Broker.md` — fetch logic and tier threshold config
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
