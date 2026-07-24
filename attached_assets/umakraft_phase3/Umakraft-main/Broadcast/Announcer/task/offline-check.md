# Task: Offline Check

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Owner:** Announcer — Stage 5, Broadcast
**Version:** v1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

Alert the circle leader when a member has not been seen on the uma.moe platform for
longer than the configured offline threshold. Fires per-member once the threshold is
crossed, then deduplicates until the member returns and the notification window resets.

---

## Schedule

| Field | Value |
|-------|-------|
| Cron | `0 */6 * * *` |
| Interval | Every 6 hours |
| Effective fire | Announcer delivers when Archive-Inspector confirms a member's last-seen timestamp exceeds the offline threshold and no current-window notification exists in Archive |

---

## Registration

```javascript
schedule('offline-check', '0 */6 * * *', (client) => broker.run('offlineCheck', client));
```

---

## Data Flow

```text
Broker fetches:  Refinery/Depot — member last-seen timestamps for the circle
Inspector checks per member:
  1. (now - lastSeen) > offlineThresholdDays?
  2. No existing Archive record for notificationKey "offline-check:{circleId}:{memberId}:{windowDate}"?
If all pass → Archive record written → Archive-Transporter → Announcer
```

`windowDate` is the calendar date the threshold was first crossed, preventing re-alerts
within the same offline episode. When a member returns and goes offline again, the new
episode gets a new `windowDate` and a fresh notification.

---

## Notification Key Format

```
offline-check:{circleId}:{memberId}:{YYYY-MM-DD}
```

`YYYY-MM-DD` is the date the offline threshold was first crossed for this episode.

Example: `offline-check:circle-001:member-011:2026-07-18`

---

## Payload

```json
{
  "type": "offlineCheck",
  "variant": 1,
  "memberId": "member-011",
  "memberName": "Kai",
  "lastSeenAt": "2026-07-18T07:30:00.000Z",
  "daysOffline": 4,
  "threshold": 3,
  "message": "Kai has not been seen for 4 days (threshold: 3).",
  "imageParams": null
}
```

`imageParams` is `null` — offline alerts are text-only; no image card is rendered.

---

## Recipients

| Target | Source |
|--------|--------|
| Channel | `null` — offline alerts are private; no channel post |
| Member DMs | `null` — alert is not sent to the offline member |
| Leader DM | Circle leader's linked Discord user |

`channelSent` and `dmMemberSent` are marked done at write time by Archive-Inspector.
Only `dmLeaderSent` represents meaningful delivery state for this notification type.

---

## Delivery Steps (Announcer)

1. `channelSent` — not applicable; set to 1 by Archive-Inspector at write time
2. `dmMemberSent` — not applicable; set to 1 by Archive-Inspector at write time
3. Check `dmLeaderSent` flag — if 0, DM the circle leader with the offline summary

Each step updates its Archive flag on success. Failed leader DMs are retried on the
next Broker tick via Archive-Transporter.

---

## Failure / Retry

If the leader DM fails, Announcer leaves `dmLeaderSent` at 0 and logs the error. On
the next Broker tick (6 hours), restart-recovery surfaces the record via
`Archive.getIncomplete()` → Archive-Transporter → Announcer for retry.

---

## See Also

- `Broadcast/Broker/Broker.md` — last-seen fetch and threshold config
- `Broadcast/Announcer/Announcer.md` — delivery engine
- `Broadcast/Announcer/task/README.md` — task directory overview
