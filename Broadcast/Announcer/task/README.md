# Announcer / task

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 5 — Broadcast (Deliver Notifications)
**Last Updated:** 2026-07-22

---

## Purpose

This directory contains the **cron task definitions** owned by Announcer — one file per
notification type. Each task describes its schedule, what data it waits for, and how it
routes through the Broadcast pipeline to Announcer for delivery.

Tasks in this directory are the **source of truth** for when each notification fires and
what triggers Announcer. They are registered with `tasks/index.js` at boot time and
executed on their configured cron interval.

---

## How a Task Triggers Announcer

Announcer is never called directly by the scheduler. The path is always:

```text
tasks/index.js  (cron tick)
     │
     ▼
Broker.run(type, client)
     │  fetches compiled data from Refinery/Depot
     ▼
Archive-Inspector.evaluate(input)
     │  checks eligibility + dedup; if approved → writes Archive record
     ▼
Archive-Transporter.fetch(notificationKey, client)
     │  reads full record from Archive; validates
     ▼
Announcer.deliver(record, client)
     │  renders card, posts channel, sends DMs, marks flags
     ▼
Discord
```

**Announcer is triggered when data is available** — meaning Archive-Inspector has
evaluated the data Broker fetched and approved a new notification. Only then does
Archive-Transporter hand the record to Announcer.

If the data does not qualify (threshold not met, dedup hit, tally closed), Archive-Inspector
rejects cleanly and Announcer is never called for that tick.

---

## Task Registration

Each task is registered in `tasks/index.js` using `schedule()`:

```javascript
import { schedule } from '../tasks/index.js';
import * as broker from '../Broadcast/Broker/broker.js';

schedule('daily-warning',    '0 * * * *',    (client) => broker.run('dailyWarning',    client));
schedule('achievement-tier', '*/5 * * * *',  (client) => broker.run('achievementTier', client));
schedule('milestone',        '*/10 * * * *', (client) => broker.run('milestone',        client));
schedule('leaderboard',      '0 * * * *',    (client) => broker.run('leaderboard',      client));
schedule('greeting',         '0 * * * *',    (client) => broker.run('greeting',         client));
schedule('offline-check',    '0 */6 * * *',  (client) => broker.run('offlineCheck',     client));
schedule('weekly-warning',   '0 9 * * 1',    (client) => broker.run('weeklyWarning',    client));
schedule('inter-circle',     '0 */4 * * *',  (client) => broker.run('interCircle',      client));
```

`start(client)` is called once from `Distribution/Discord/events/ready.js` after the bot
connects to the Discord gateway.

---

## Task Files

| File | Notification type | Default schedule |
|------|-------------------|-----------------|
| `daily-warning.md` | Daily fan deficit warning | Hourly |
| `achievement-tier.md` | Achievement tier crossed | Every 5 minutes |
| `milestone.md` | Monthly fan milestone | Every 10 minutes |
| `leaderboard.md` | Daily / weekly leaderboard | Hourly |
| `greeting.md` | Member daily greeting | Hourly (timezone-aware) |
| `offline-check.md` | Member offline alert | Every 6 hours |
| `weekly-warning.md` | Weekly fan deficit warning | Monday 09:00 |
| `inter-circle.md` | Inter-circle comparison | Every 4 hours |

---

## Ownership Rules

- **Announcer owns delivery.** The task definitions here exist to trigger Broker, which
  feeds Announcer. Do not bypass Broker or Archive-Inspector.
- **One task per notification type.** Tasks are not duplicated across directories.
- **Schedule changes belong here.** Update the cron expression in the relevant task file
  and in `tasks/index.js`. Nowhere else.
- **No eligibility logic in task files.** Eligibility belongs to Archive-Inspector.

---

## See Also

- `Broadcast/Broker/Broker.md` — data fetch and trigger details
- `Broadcast/Announcer/Announcer.md` — delivery engine specification
- `tasks/index.js` — cron scheduler and `schedule()` / `start()` API
- `GOVERNANCE/PIPELINE_REGISTRY.md` — Broadcast stage ownership
