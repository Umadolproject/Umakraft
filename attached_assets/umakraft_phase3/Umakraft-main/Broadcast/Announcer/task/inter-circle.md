# Task: Inter-Circle

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Post a comparative fan-gain snapshot across all configured circles, giving members
visibility on how their circle is performing relative to others over the same period.
Fires on a regular cadence when a compiled multi-circle snapshot is available in
Refinery/Depot.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `0 */4 * * *` |
| Interval | Every 4 hours |
| Effective fire | Announcer delivers when Archive-Inspector confirms a fresh multi-circle compiled snapshot exists and no record for the current snapshot window has been written yet |

---

## Registration

```javascript
schedule('inter-circle', '0 */4 * * *', (client) => broker.run('interCircle', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — multi-circle compiled snapshot (all configured circles, same period)
Inspector checks:
  1. Snapshot is fresh (compiled within the current 4-hour window)?
  2. At least two circles have data?
  3. No existing Archive record for notificationKey "inter-circle:{windowTimestamp}"?
If all pass → Archive record written per target circle → Archive-Transporter → Announcer
```

Each target circle receives its own Archive record so delivery state is tracked
independently. A failure to post to one circle's channel does not block others.

---

## Notification Key Format

```
inter-circle:{circleId}:{YYYY-MM-DDTHH}
```

`YYYY-MM-DDTHH` is the UTC hour the 4-hour window started (e.g. `2026-07-22T08`
for the 08:00–12:00 UTC window).

Example: `inter-circle:circle-001:2026-07-22T08`

---

## Payload

```json
{
  "type": "interCircle",
  "variant": 2,
  "windowStart": "2026-07-22T08:00:00.000Z",
  "windowEnd": "2026-07-22T12:00:00.000Z",
  "targetCircleId": "circle-001",
  "rankings": [
    { "rank": 1, "circleId": "circle-002", "circleName": "Dawn",  "fanGain": 48200 },
    { "rank": 2, "circleId": "circle-001", "circleName": "Ember", "fanGain": 41500 },
    { "rank": 3, "circleId": "circle-003", "circleName": "Frost", "fanGain": 33100 }
  ],
  "message": "Inter-circle update: Ember is ranked #2 this window with +41,500 fans.",
  "imageParams": {
    "type": "interCircle",
    "targetCircleId": "circle-001",
    "rankings": [ ... ]
  }
}
```

`targetCircleId` is the circle whose channel and members receive this copy of the
notification. Each circle gets a tailored message highlighting its own rank.

---

## Recipients

| Target | Source |
|--------|--------|
| Channel | Each circle's configured notification channel (one Archive record per circle) |
| Member DMs | `null` — inter-circle updates are channel-only; no individual DMs |
| Leader DM | Circle leader (if configured) |

`dmMemberSent` is set to 1 by Archive-Inspector at write time for this notification type.

---

## Delivery Steps (Announcer)

1. Check `channelSent` flag — if 0, render comparison card via Fabricator → post to channel
2. `dmMemberSent` — not applicable; set to 1 by Archive-Inspector at write time
3. Check `dmLeaderSent` flag — if 0, DM the circle leader with the ranking summary

Each step updates its Archive flag on success. Failed steps are retried on the next
Broker tick via Archive-Transporter.

---

## Failure / Retry

If the channel post or leader DM fails for a given circle, that circle's Archive record
retains `channelSent=0` or `dmLeaderSent=0`. On the next Broker tick (4 hours) or on
restart, `Archive.getIncomplete()` surfaces the record → Archive-Transporter → Announcer.
Other circles with successful delivery are unaffected — each has its own Archive record.

---

## See Also

- `Broadcast/Broker/Broker.md` — multi-circle snapshot fetch
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
