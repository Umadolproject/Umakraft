# UmaKraft Circle Bot — Role Architecture

**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**References:** `PIPELINE_REGISTRY.md`, `PIPELINE_OPERATIONS.md`, `PIPELINE_EVOLUTION.md`, `ARCHITECTURE_DECISIONS.md`
**Version:** 2.0.0
**Last Updated:** 2026-07-19

This document defines the role of every major directory in the UmaKraft Circle Bot codebase,
the boundaries each directory must respect, the full data pipeline, and a precise inventory
of every file that is affected when the split is carried out.

> **Authority note:** This document describes implementation structure.
> For ownership rules, dependency law, and pipeline governance, the five constitutional
> documents above are the supreme authority. If this document and those documents conflict,
> the constitutional documents prevail.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Roles](#2-directory-roles)
   - [Umamoe](#21-umamoe--raw-data-pipeline)
   - [Refinery](#22-refinery--computed-data-pipeline)
   - [Workshop](#23-workshop--deliverable-manufacturing)
   - [Broadcast](#24-broadcast--event-notification-pipeline)
   - [Distribution](#25-distribution--command-response-routing)
   - [Core / DB / Utils / Tasks](#26-core--db--utils--tasks--shim-and-support-layer)
3. [Boundary Rules](#3-boundary-rules)
4. [Affected Code — Full Inventory](#4-affected-code--full-inventory)
   - [Files that move to Refinery](#41-files-that-move-to-refinery)
   - [Files that move to Workshop](#42-files-that-move-to-workshop)
   - [Files that move to Broadcast](#43-files-that-move-to-broadcast)
   - [Shims to create or update](#44-shims-to-create-or-update)
   - [New files to create](#45-new-files-to-create)
   - [Files that do not change](#46-files-that-do-not-change)
5. [Implementation Order](#5-implementation-order)

---

## 1. Architecture Overview

```text
uma.moe API
     │
     ▼
┌─────────────────────────────────────────────┐
│  Umamoe/                                    │  RAW DATA
│  Miner → Courier → Inspector → Vault        │
└─────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────┐
│  Refinery/                                  │  COMPUTED DATA
│  Refiner → Compiler → Depot                 │
└─────────────────────────────────────────────┘
     │
     ├─────────────────────────────────────────────────────┐
     │                                                     │
     ▼                                                     ▼
┌─────────────────────────────────────────────┐  ┌──────────────────────────────────────────┐
│  Workshop/                                  │  │  Broadcast/                              │
│  Draftsman → Fabricator → Validator →       │  │  Broker → Inspector → Archive →          │
│  Terminal                                   │  │  Announcer                               │
└─────────────────────────────────────────────┘  └──────────────────────────────────────────┘
     │                                                     │
     ▼                                                     │
┌─────────────────────────────────────────────┐           │
│  Distribution/                              │           │
│  Retriever → Dispatcher                     │           │
└─────────────────────────────────────────────┘           │
     │                                                     │
     └─────────────────────┬───────────────────────────────┘
                           ▼
                Discord (slash replies, channel posts, DMs)
```

**Two separate output paths from Refinery/Depot:**

- **Workshop → Distribution** — the **pull** path. A user runs a slash command,
  the system manufactures a deliverable on demand and sends the reply.
- **Broadcast** — the **push** path. A cron schedule fires or a data threshold is
  crossed; the system evaluates who qualifies, claims the notification in the
  database, renders the content, and delivers it automatically without any user request.

These two paths are completely independent. They never call each other.

---

## 2. Directory Roles

### 2.1 `Umamoe/` — Raw Data Pipeline

**One sentence:** Fetches raw data from uma.moe, validates it, and stores it as trusted.

**Departments:**

| Department | File | Responsibility | Status |
|---|---|---|---|
| Miner | `umamoe/Miner/miner.js` | HTTP requests to approved uma.moe endpoints only; rate-limiting; exponential backoff retry | IMPLEMENTED |
| Courier | `umamoe/Courier/courier.js` | Transports Miner output to Inspector unchanged; basic transportability checks only | IMPLEMENTED |
| Inspector | `umamoe/Inspector/inspector.js` | Validates structure, completeness, types, and ranges; accepts or rejects; does not modify | IMPLEMENTED |
| Vault | `umamoe/Vault/vault.js` | Stores accepted trusted envelopes; provides retrieval to Refinery only | IMPLEMENTED |

**May:**
- Fetch from approved endpoints (`umamoe/MINER_ENDPOINTS.md`)
- Validate raw API response shape
- Store `{ trustedData, metadata }` envelopes

**Must not:**
- Compute fan gains, trends, rankings, or any derived value
- Render Discord embeds or image cards
- Write to databases outside `Vault/`
- Send anything to Discord

**Implemented pipeline files:**

```
umamoe/Miner/miner.js         ✅ IMPLEMENTED
umamoe/Courier/courier.js     ✅ IMPLEMENTED
umamoe/Inspector/inspector.js ✅ IMPLEMENTED  (rules: Inspector/VALIDATION_RULES.md)
umamoe/Vault/vault.js         ✅ IMPLEMENTED  (adapters: Vault/adapters/inmemory.js, file.js)
```

**Legacy files pending absorption into departments:**

```
umamoe/umaClient.js       → Miner  (HTTP client + rate queue; currently used as shim source)
umamoe/umaQueue.js        → Miner  (rate-limit logic; currently used as shim source)
umamoe/umaCache.js        → Vault  (in-memory adapter; will be replaced by Vault/adapters/)
umamoe/uma.js             → Vault  (barrel: buildSnapshot, getCircleSnapshot — shim source)
umamoe/umaStats.js        → Refinery/Refiner  (fan delta computation — MISPLACED in Umamoe)
umamoe/history/           stays — Vault-adjacent historical join-date data store
umamoe/timeline/          stays — external data pipeline for event timeline (self-contained)
umamoe/trainer/           stays — trainer card scrapers + renderers (stays in Umamoe)
umamoe/profileBackfill.js stays — historical backfill utility
umamoe/index.js           stays — barrel export
```

---

### 2.2 `Refinery/` — Computed Data Pipeline

**One sentence:** Reads trusted data from the Vault, applies business logic and calculations,
assembles finished products, and stores them in the Depot.

**Departments:**

| Department | File | Responsibility | Status |
|---|---|---|---|
| Refiner | `Refinery/Refiner/refiner.js` | Domain calculations: fan gain deltas, trends, pace flags, milestone eligibility, achievement checks | IMPLEMENTED |
| Compiler | `Refinery/Compiler/compiler.js` | Assembles multiple `refinedResult` envelopes from the Refiner into a single `compiledProduct` | IMPLEMENTED |
| Depot | `Refinery/Depot/depot.js` | Persists compiled products with `id` and `version`; serves Workshop and Broadcast on request | IMPLEMENTED |

**May:**
- Read from `Vault` (read-only; must not write to Vault)
- Compute derived values: daily/weekly/monthly fan gains, velocity, pace, quotas, trends, flags
- Assemble and store compiled products in `Depot`

**Must not:**
- Fetch data from uma.moe directly
- Store raw API payloads
- Render Discord embeds or image cards
- Send anything to Discord

**Spec docs (already in repo):**

```
Refinery/README.md
Refinery/Overview.md
Refinery/Refiner/Refiner.md
Refinery/Compiler/Compiler.md
Refinery/Depot/Depot.md
Refinery/tests/refiner.test.js
Refinery/tests/vault.test.js
```

**fantracking/ code pending assimilation into Refinery:**

```
umamoe/umaStats.js              → Refinery/Refiner/umaStats.js      (fan delta — MISPLACED)
fantracking/velocity/index.js   → Refinery/Refiner/velocity.js      (rolling 7-day avg + projection)
fantracking/achievements/daily.js → Refinery/Refiner/achievements.js (per-trainer achievement flags)
fantracking/milestone/eval.js   → Refinery/Refiner/milestoneEval.js  (milestone tier eligibility)
fantracking/sync/dataSync.js    → Refinery/Compiler/dataSync.js      (full sync orchestration)
fantracking/sync/circleQueue.js → Refinery/Compiler/circleQueue.js   (per-circle queue management)
fantracking/aggregation/index.js → Refinery/Compiler/aggregation.js  (weekly/monthly aggregates)
fantracking/leaderboard/snapshotDb.js → Refinery/Depot/leaderboardSnapshotDb.js
fantracking/links/db.js         → Refinery/Depot/linksDb.js
fantracking/links/repository.js → Refinery/Depot/linksRepository.js
```

---

### 2.3 `Workshop/` — Deliverable Manufacturing

**One sentence:** Retrieves compiled products from the Depot, manufactures user-facing Discord
deliverables following per-command blueprints, validates them, and hands them to Distribution.

**Departments:**

| Department | File | Responsibility | Status |
|---|---|---|---|
| Draftsman | `Workshop/Draftsman/draftsman.js` | Defines and manages the specification (layout, fields, visual rules) for each deliverable type | IMPLEMENTED |
| Fabricator | `Workshop/Fabricator/fabricator.js` | Constructs the deliverable (Discord embed + image card) from a blueprint and compiled product | IMPLEMENTED |
| Validator | `Workshop/Validator/Validator.js` | Checks the deliverable against its blueprint spec; approves or rejects before release | IMPLEMENTED |
| Terminal | `Workshop/Terminal/terminal.js` | Immutable staging area for approved deliverables awaiting Distribution pickup | IMPLEMENTED |

**May:**
- Read compiled products from `Depot`
- Render Discord embeds and image report cards
- Validate deliverable shape against blueprint specs
- Hold approved deliverables in Terminal

**Must not:**
- Compute fan gains or any business logic
- Write to Vault or Depot
- Send deliverables directly to Discord (that is Distribution's job)
- Modify a deliverable after it has been approved and placed in Terminal

> **Fabricator vs Broadcast/Announcer:** Fabricator renders the visual product — it builds the
> Discord embed structure and generates the image card buffer. Broadcast/Announcer is what
> delivers that rendered product to Discord with dedup and retry tracking. Files that
> currently do both (e.g. `milestone/notifier.js`, `leaderboard/announcements.js`) will be
> split: the render logic goes to Fabricator, the delivery logic goes to Announcer.

**Spec docs and blueprints (already in repo):**

```
Workshop/README.md
Workshop/Workshop.md
Workshop/Draftsman/Draftsman.md
Workshop/Fabricator/Fabricator.md
Workshop/Fabricator/README.md
Workshop/Validator/Validator.md
Workshop/Terminal/Terminal.md
Workshop/Terminal/README.md
Workshop/Draftsman/Blueprint/README.md
Workshop/Draftsman/Blueprint/blueprint.md
Workshop/Draftsman/Blueprint/blueprints-usage.md
Workshop/Draftsman/Blueprint/blueprints.js
Workshop/Draftsman/Blueprint/command-blueprints.json
```

**Blueprint specs (all present):**

```
Workshop/Draftsman/Blueprint/leaderboard.md    ✅
Workshop/Draftsman/Blueprint/milestone.md      ✅
Workshop/Draftsman/Blueprint/warning.md        ✅
Workshop/Draftsman/Blueprint/greeting.md       ✅
Workshop/Draftsman/Blueprint/help.md           ✅
Workshop/Draftsman/Blueprint/total_fan.md      ✅
Workshop/Draftsman/Blueprint/circle_master.md  ✅
Workshop/Draftsman/Blueprint/joindate.md       ✅
Workshop/Draftsman/Blueprint/store.md          ✅
Workshop/Draftsman/Blueprint/timeline.md       ✅
Workshop/Draftsman/Blueprint/fan_gain.md       ✅
Workshop/Draftsman/Blueprint/profile.md        ✅
Workshop/Draftsman/Blueprint/circle.md         ✅
Workshop/Draftsman/Blueprint/link.md           ✅
Workshop/Draftsman/Blueprint/set_fans.md       ✅
```

**fantracking/ code pending assimilation into Workshop:**

```
  ─ Full move — render-only files → Workshop/Fabricator/reports/ ─
fantracking/reports/ImageReportStandard.js  → Workshop/Fabricator/ImageReportStandard.js
fantracking/reports/fanGain.js              → Workshop/Fabricator/reports/fanGain.js
fantracking/reports/leaderboard.js          → Workshop/Fabricator/reports/leaderboard.js
fantracking/reports/circleMaster.js         → Workshop/Fabricator/reports/circleMaster.js
fantracking/reports/dailyFanWarning.js      → Workshop/Fabricator/reports/dailyFanWarning.js
fantracking/reports/dailyAchievement.js     → Workshop/Fabricator/reports/dailyAchievement.js
fantracking/reports/milestone.js            → Workshop/Fabricator/reports/milestone.js
fantracking/reports/fanDeficit.js           → Workshop/Fabricator/reports/fanDeficit.js
fantracking/reports/warnings.js             → Workshop/Fabricator/reports/warnings.js
fantracking/reports/warningCard.js          → Workshop/Fabricator/reports/warningCard.js
fantracking/reports/greeting.js             → Workshop/Fabricator/reports/greeting.js
fantracking/reports/help.js                 → Workshop/Fabricator/reports/help.js
fantracking/reports/joindate.js             → Workshop/Fabricator/reports/joindate.js
fantracking/reports/profile.js              → Workshop/Fabricator/reports/profile.js
fantracking/reports/store.js                → Workshop/Fabricator/reports/store.js
fantracking/reports/timeline.js             → Workshop/Fabricator/reports/timeline.js
fantracking/reports/linkList.js             → Workshop/Fabricator/reports/linkList.js
fantracking/warnings/fanDeficitApi.js       → Workshop/Terminal/fanDeficitApi.js

  ─ Split move — render → Fabricator, delivery → Broadcast/Announcer ─
fantracking/leaderboard/announcements.js  render → Workshop/Fabricator/renders/leaderboard.js
                                          send   → Broadcast/Announcer/leaderboardAnnouncer.js
fantracking/milestone/notifier.js         render → Workshop/Fabricator/renders/milestone.js
                                          send   → Broadcast/Announcer/milestoneAnnouncer.js
fantracking/warnings/imageReport.js       render → Workshop/Fabricator/renders/warningReport.js
                                          send   → Broadcast/Announcer/warningAnnouncer.js
```

---

### 2.4 `Broadcast/` — Event Notification Pipeline

**One sentence:** Broker fetches compiled data from Refinery/Depot and hands it to Inspector;
Inspector validates eligibility and — if approved — writes the full notification record
to Archive; Announcer reads from Archive and delivers to Discord with per-step
dedup and restart-safe retry.

**Why Broadcast is separate from Workshop:** Workshop is a pull model — it manufactures a
deliverable in response to a user command. Broadcast is a push model — it fires automatically
on a cron schedule or data threshold without any user request. The two models have
incompatible triggers, incompatible recipients (one vs many), incompatible dedup requirements,
and incompatible retry patterns. Forcing push notifications through Workshop would break
every department's single-responsibility rule.

**Departments:**

| Department | File | Responsibility | Status |
|---|---|---|---|
| Broker | `Broadcast/Broker/broker.js` | Triggered by cron or threshold; fetches compiled data from Refinery/Depot; manages per-circle queue; on restart reads Archive for incomplete records and routes to Announcer | IMPLEMENTED |
| Inspector | `Broadcast/archive-inspector/archiveInspector.js` | Receives raw data from Broker; runs eligibility, dedup, recipient resolution, variant selection; if approved: writes full notification record to Archive; if rejected: drops cleanly | IN PROGRESS |
| Archive | `Broadcast/Archive/archive.js` | Pure storage. Holds notification records and delivery state. Written by Inspector (new records) and Announcer (flag updates). Read by Announcer (delivery plan) and Broker (incomplete records on restart) | IMPLEMENTED |
| Announcer | `Broadcast/Announcer/announcer.js` | Reads full notification record from Archive by notificationKey; renders image card via Workshop/Fabricator; posts to channel; sends member DMs; sends leader DM; updates each delivery flag in Archive on success | IMPLEMENTED |

**Data flow:**

```
Refinery/Depot
     │  ← Broker fetches compiled data
     ▼
  Broker       triggered by cron / threshold event
     │  raw data envelope
     ▼
  Inspector    eligibility · dedup · recipients · variant
     │  reject → drop (nothing written)
     │  approve ↓
     ▼
  Archive      pure storage — Inspector writes; Announcer reads + updates flags
     │  ← Announcer reads notificationKey
     ▼
  Announcer    render card → post channel → send DMs → update Archive flags
     │
     ▼
Discord (channel posts, member DMs, leader DMs)

  ── restart recovery ──
  Broker reads Archive.getIncomplete() → Announcer (skip Inspector)
```

**Writer / reader contract for Archive:**

| Operation | Caller |
|---|---|
| `INSERT` new record | Inspector only |
| `UPDATE` delivery flags | Announcer only |
| `INSERT` history row | Announcer only |
| `SELECT` incomplete records | Broker only (restart recovery) |
| `SELECT` record by key | Announcer only |

**Spec docs (already in repo):**

```
Broadcast/README.md
Broadcast/Overview.md
Broadcast/Broker/Broker.md
Broadcast/archive-inspector/archive-inspector.md
Broadcast/Archive/Archive.md
Broadcast/Announcer/Announcer.md
Broadcast/archive_transporter/archive_transporter.md
```

**Notification types handled by Broadcast:**

| Notification | Trigger | Recipients |
|---|---|---|
| Daily greeting | 07:00 JST cron | Channel post + per-member DM in their local timezone |
| Noon / night / midnight messages | Hourly cron, per-member timezone check | Member DM only |
| Offline check | Daily cron, days-since-last-online check | Member DM (escalating 1/2/3+ day variants) |
| Daily fan warning | 23:45 JST (after tally), fan goal missed | Channel post + all linked member DMs |
| Daily achievement tier | Hourly, total fans crosses threshold | Channel post + all linked member DMs |
| Weekly fan warning | End of week, weekly goal missed | Channel post + member DMs |
| Monthly fan warning | End of month, monthly goal missed | Channel post + member DMs |
| Milestone | Monthly, per-trainer fan count tier crossed | Channel post + trainer DM + leader DM |
| Leaderboard announcement | Daily/weekly tally complete | Channel post + top-3 DMs |
| Fan deficit image report | Daily tally check | Channel post |
| Inter-circle leaderboard | Weekly | Channel post |

**fantracking/ and tasks/ code pending assimilation into Broadcast:**

```
  ─ Broker ─
fantracking/milestone/milestones.js      → Broadcast/Broker/milestoneBroker.js
tasks/dailyGreetingReport.js             → Broadcast/Broker/greetingBroker.js
tasks/dailyMessages.js                   → Broadcast/Broker/dailyMessageBroker.js
tasks/offlineCheck.js                    → Broadcast/Broker/offlineCheckBroker.js
tasks/weeklyAnnouncement.js              → Broadcast/Broker/weeklyAnnouncementBroker.js
tasks/interCircleAnnouncements.js        → Broadcast/Broker/interCircleBroker.js

  ─ Inspector ─
fantracking/milestone/tiers.js           → Broadcast/Inspector/milestoneTiers.js
fantracking/milestone/winners.js         → Broadcast/Inspector/milestoneWinners.js
fantracking/milestone/cleanup.js         → Broadcast/Inspector/milestoneCleanup.js
fantracking/warnings/engine.js           → Broadcast/Inspector/warningInspector.js
fantracking/warnings/daily.js            → Broadcast/Inspector/dailyWarningInspector.js
fantracking/warnings/weekly.js           → Broadcast/Inspector/weeklyWarningInspector.js
fantracking/warnings/monthly.js          → Broadcast/Inspector/monthlyWarningInspector.js

  ─ Archive ─
fantracking/milestone/db.js              → Broadcast/Archive/milestoneArchive.js
fantracking/warnings/db.js               → Broadcast/Archive/warningArchive.js
fantracking/achievements/db.js           → Broadcast/Archive/achievementArchive.js

  ─ Announcer (delivery portions only; render portions → Workshop/Fabricator) ─
fantracking/milestone/notifier.js        → Broadcast/Announcer/milestoneAnnouncer.js
fantracking/leaderboard/announcements.js → Broadcast/Announcer/leaderboardAnnouncer.js
fantracking/warnings/imageReport.js      → Broadcast/Announcer/warningAnnouncer.js
tasks/fanDeficitImageReport.js           → Broadcast/Announcer/fanDeficitAnnouncer.js
```

---

### 2.5 `Distribution/` — Command Response Routing

**One sentence:** Retrieves approved deliverables from Workshop/Terminal and routes them
to the correct Discord destination in response to a user slash command.

**Status: PENDING FORMALIZATION** — `Distribution/` directory does not yet exist.
Its role is currently carried out by `commands/` and `handlers/`.

**Departments (to be created):**

| Department | File | Responsibility |
|---|---|---|
| Retriever | `Distribution/Retriever/retriever.js` | Pulls approved deliverables from Workshop/Terminal |
| Dispatcher | `Distribution/Dispatcher/dispatcher.js` | Routes the deliverable to the correct Discord channel, user DM, or command reply |

**Currently handled by:**

```
commands/*.js   (26 slash command files)
handlers/*.js   (6 Discord event files: ready.js, interactionCreate.js,
                 messageCreate.js, guildMemberAdd.js, presenceUpdate.js,
                 onboardingHandler.js)
```

**Supporting utilities that stay permanently (used by both Dispatcher and Announcer):**

```
utils/dm.js         — DM delivery wrapper
utils/updateLog.js  — log channel posting
utils/autoDelete.js — auto-delete ephemeral messages
```

> Distribution is formalized as a later-stage task after Refinery, Workshop, and Broadcast
> assimilation is complete.

---

### 2.6 `core/` / `db/` / `utils/` / `tasks/` — Shim and Support Layer

These directories hold two kinds of files:

**1. Shims** — thin re-export files that point to the real implementation. They exist so
existing `import` paths in commands and handlers keep working without a mass-rewrite.
Every shim contains only one line of substance: `export * from '../<real-location>';`

**2. Genuine support utilities** — files that don't belong to any pipeline stage and are
used across multiple stages. These stay permanently.

| File | Type | Stays or moves? |
|---|---|---|
| `core/config.js` | Support | Stays permanently |
| `core/log.js` | Support | Stays permanently (single logging interface for all departments) |
| `core/store.js` | Support | Stays permanently |
| `core/format.js` | Support | Stays permanently |
| `core/errors.js` | Support | Stays permanently (`safeRun()`, `withRetry()` used by all departments) |
| `core/channels.js` | Support | Stays permanently (used by Announcer + Dispatcher) |
| `core/channel-utils.js` | Support | Stays permanently |
| `core/channelPerms.js` | Support | Stays permanently |
| `core/busyLock.js` | Support | Stays permanently |
| `core/quotaKeys.js` | Support | Stays permanently |
| `core/taskRegistry.js` | Support | Stays permanently (task monitoring for all departments) |
| `core/health.js` | Support | Stays permanently (`/health` endpoint) |
| `core/tally.js` | Support | Stays permanently |
| `core/monthlyHistory.js` | Support | Stays permanently |
| `core/tokenLoader.js` | Support | Stays permanently (bootstrap only) |
| `core/docsStudio.js` | Support | Stays permanently |
| `core/reportStudio.js` | Support | Stays permanently |
| `core/slidesStudio.js` | Support | Stays permanently |
| `core/uma.js` | Shim → `umamoe/uma.js` | Stays as shim (target → Vault after absorption) |
| `core/umaClient.js` | Shim → `umamoe/umaClient.js` | Stays as shim (target → Miner after absorption) |
| `core/umaCache.js` | Shim → `umamoe/umaCache.js` | Stays as shim (target → Vault after absorption) |
| `core/umaQueue.js` | Shim → `umamoe/umaQueue.js` | Stays as shim (target → Miner after absorption) |
| `core/umaStats.js` | Shim → `umamoe/umaStats.js` | Updates target → `Refinery/Refiner/umaStats.js` after move |
| `core/milestoneEval.js` | Shim → `fantracking/milestone/eval.js` | Updates target → `Refinery/Refiner/milestoneEval.js` after move |
| `core/milestoneImages.js` | Shim → `fantracking/milestone/images.js` | Stays (images stays in fantracking) |
| `core/fanDeficitApi.js` | Shim → `fantracking/warnings/fanDeficitApi.js` | Updates target → `Workshop/Terminal/fanDeficitApi.js` after move |
| `core/deploy-commands.js` | Support | Stays permanently |
| `db/linksDb.js` | Shim → `fantracking/links/db.js` | Updates target → `Refinery/Depot/linksDb.js` after move |
| `db/achievementDb.js` | Shim → `fantracking/achievements/db.js` | Updates target → `Broadcast/Archive/achievementArchive.js` after move |
| `db/milestoneDb.js` | Shim → `fantracking/milestone/db.js` | Updates target → `Broadcast/Archive/milestoneArchive.js` after move |
| `db/warningDb.js` | Shim → `fantracking/warnings/db.js` | Updates target → `Broadcast/Archive/warningArchive.js` after move |
| `db/leaderboardSnapshotDb.js` | Shim → `fantracking/leaderboard/snapshotDb.js` | Updates target → `Refinery/Depot/leaderboardSnapshotDb.js` after move |
| `db/attendanceDb.js` | Shim → `fantracking/attendance/db.js` | Stays (attendance is independent) |
| `db/migrations.js` | Support | Stays permanently (migration runner for all DBs) |
| `db/storeDb.js` | Support | Stays permanently |
| `db/trainerColorDb.js` | Support | Stays permanently |
| `db/trainerDb.js` | Support | Stays permanently |
| `db/onboardingDb.js` | Support | Stays permanently |
| `db/attendanceDb.js` | Support | Stays permanently |
| `db/imageArchiveDb.js` | Support | Stays permanently |
| `db/circleDb.js` | Support | Stays permanently |
| `db/profileSyncDb.js` | Support | Stays permanently |
| `db/stadiumDb.js` | Support | Stays permanently |
| `db/historicalCacheDb.js` | Support | Stays permanently |
| `db/timelineCache.js` | Support | Stays permanently |
| `utils/milestoneNotifier.js` | Shim → `fantracking/milestone/notifier.js` | Updates target → `Broadcast/Announcer/milestoneAnnouncer.js` after move |
| `utils/reports/*.js` (16 files) | Shims → `fantracking/reports/*.js` | Update targets → `Workshop/Fabricator/reports/` after move |
| `utils/pastHistoryReader.js` | Shim → `umamoe/history/` | Stays as shim |
| `utils/generatePastHistoryMd.js` | Shim → `umamoe/history/` | Stays as shim |
| `utils/profileBackfill.js` | Shim → `umamoe/profileBackfill.js` | Stays as shim |
| `utils/resumeCard.js` | Shim → `umamoe/trainer/resumeCard.js` | Stays as shim |
| `utils/skillScraper.js` | Shim → `umamoe/trainer/skillScraper.js` | Stays as shim |
| `utils/dm.js` | Support | Stays permanently (Announcer + Dispatcher) |
| `utils/updateLog.js` | Support | Stays permanently |
| `utils/autoDelete.js` | Support | Stays permanently |
| `utils/imageReport.js` | Support | Stays permanently (Playwright render engine) |
| `utils/imageReport-browser.js` | Support | Stays permanently |
| `utils/imageClassifier.js` | Support | Stays permanently |
| `utils/activityLog.js` | Support | Stays permanently |
| `utils/changelog.js` | Support | Stays permanently |
| `utils/characterData.js` | Support | Stays permanently |
| `utils/cardCache.js` | Support | Stays permanently |
| `utils/verificationHelper.js` | Support | Stays permanently |
| `tasks/index.js` | Distribution scheduler | Stays (cron entry point; calls into Broker) |
| `tasks/*.js` shims | Shims → `fantracking/` or `Broadcast/` | Update shim target after move |

---

## 3. Boundary Rules

These rules are absolute. If any code violates a boundary, the split has not been done correctly.

| Directory | May read from | May write to | May send to Discord |
|---|---|---|---|
| `Umamoe` | uma.moe API | Vault only | No |
| `Refinery` | Vault (read-only) | Depot only | No |
| `Workshop` | Depot (read-only) | Terminal only | No |
| `Broadcast` | Depot (read-only), Archive | Archive | Yes — channel posts + DMs |
| `Distribution` | Terminal (read-only) | None | Yes — command replies |

**Data flows in one direction only:**

```
Umamoe → Refinery → Depot → Workshop → Terminal → Distribution → Discord
                          ↘
                           Broadcast → Discord
```

No directory may import from a directory downstream of itself.
Workshop and Broadcast are parallel consumers of Depot — they never import each other.

---

## 4. Affected Code — Full Inventory

### 4.1 Files that move to `Refinery/`

| Current path | Target path in Refinery | Department |
|---|---|---|
| `umamoe/umaStats.js` | `Refinery/Refiner/umaStats.js` | Refiner |
| `fantracking/velocity/index.js` | `Refinery/Refiner/velocity.js` | Refiner |
| `fantracking/achievements/daily.js` | `Refinery/Refiner/achievements.js` | Refiner |
| `fantracking/milestone/eval.js` | `Refinery/Refiner/milestoneEval.js` | Refiner |
| `fantracking/sync/dataSync.js` | `Refinery/Compiler/dataSync.js` | Compiler |
| `fantracking/sync/circleQueue.js` | `Refinery/Compiler/circleQueue.js` | Compiler |
| `fantracking/aggregation/index.js` | `Refinery/Compiler/aggregation.js` | Compiler |
| `fantracking/leaderboard/snapshotDb.js` | `Refinery/Depot/leaderboardSnapshotDb.js` | Depot |
| `fantracking/links/db.js` | `Refinery/Depot/linksDb.js` | Depot |
| `fantracking/links/repository.js` | `Refinery/Depot/linksRepository.js` | Depot |

---

### 4.2 Files that move to `Workshop/`

**Full move — render-only files with no delivery logic:**

| Current path | Target path in Workshop | Department |
|---|---|---|
| `fantracking/reports/ImageReportStandard.js` | `Workshop/Fabricator/ImageReportStandard.js` | Fabricator |
| `fantracking/reports/fanGain.js` | `Workshop/Fabricator/reports/fanGain.js` | Fabricator |
| `fantracking/reports/leaderboard.js` | `Workshop/Fabricator/reports/leaderboard.js` | Fabricator |
| `fantracking/reports/circleMaster.js` | `Workshop/Fabricator/reports/circleMaster.js` | Fabricator |
| `fantracking/reports/dailyFanWarning.js` | `Workshop/Fabricator/reports/dailyFanWarning.js` | Fabricator |
| `fantracking/reports/dailyAchievement.js` | `Workshop/Fabricator/reports/dailyAchievement.js` | Fabricator |
| `fantracking/reports/milestone.js` | `Workshop/Fabricator/reports/milestone.js` | Fabricator |
| `fantracking/reports/fanDeficit.js` | `Workshop/Fabricator/reports/fanDeficit.js` | Fabricator |
| `fantracking/reports/warnings.js` | `Workshop/Fabricator/reports/warnings.js` | Fabricator |
| `fantracking/reports/warningCard.js` | `Workshop/Fabricator/reports/warningCard.js` | Fabricator |
| `fantracking/reports/greeting.js` | `Workshop/Fabricator/reports/greeting.js` | Fabricator |
| `fantracking/reports/help.js` | `Workshop/Fabricator/reports/help.js` | Fabricator |
| `fantracking/reports/joindate.js` | `Workshop/Fabricator/reports/joindate.js` | Fabricator |
| `fantracking/reports/profile.js` | `Workshop/Fabricator/reports/profile.js` | Fabricator |
| `fantracking/reports/store.js` | `Workshop/Fabricator/reports/store.js` | Fabricator |
| `fantracking/reports/timeline.js` | `Workshop/Fabricator/reports/timeline.js` | Fabricator |
| `fantracking/reports/linkList.js` | `Workshop/Fabricator/reports/linkList.js` | Fabricator |
| `fantracking/warnings/fanDeficitApi.js` | `Workshop/Terminal/fanDeficitApi.js` | Terminal |

**Split move — render portion to Fabricator, delivery portion to Broadcast/Announcer:**

| Current path | Render portion → Fabricator | Delivery portion → Broadcast/Announcer |
|---|---|---|
| `fantracking/leaderboard/announcements.js` | `Workshop/Fabricator/renders/leaderboard.js` | `Broadcast/Announcer/leaderboardAnnouncer.js` |
| `fantracking/milestone/notifier.js` | `Workshop/Fabricator/renders/milestone.js` | `Broadcast/Announcer/milestoneAnnouncer.js` |
| `fantracking/warnings/imageReport.js` | `Workshop/Fabricator/renders/warningReport.js` | `Broadcast/Announcer/warningAnnouncer.js` |

---

### 4.3 Files that move to `Broadcast/`

**Broker:**

| Current path | Target path |
|---|---|
| `fantracking/milestone/milestones.js` | `Broadcast/Broker/milestoneBroker.js` |
| `tasks/dailyGreetingReport.js` | `Broadcast/Broker/greetingBroker.js` |
| `tasks/dailyMessages.js` | `Broadcast/Broker/dailyMessageBroker.js` |
| `tasks/offlineCheck.js` | `Broadcast/Broker/offlineCheckBroker.js` |
| `tasks/weeklyAnnouncement.js` | `Broadcast/Broker/weeklyAnnouncementBroker.js` |
| `tasks/interCircleAnnouncements.js` | `Broadcast/Broker/interCircleBroker.js` |

**Inspector:**

| Current path | Target path |
|---|---|
| `fantracking/milestone/tiers.js` | `Broadcast/Inspector/milestoneTiers.js` |
| `fantracking/milestone/winners.js` | `Broadcast/Inspector/milestoneWinners.js` |
| `fantracking/milestone/cleanup.js` | `Broadcast/Inspector/milestoneCleanup.js` |
| `fantracking/warnings/engine.js` | `Broadcast/Inspector/warningInspector.js` |
| `fantracking/warnings/daily.js` | `Broadcast/Inspector/dailyWarningInspector.js` |
| `fantracking/warnings/weekly.js` | `Broadcast/Inspector/weeklyWarningInspector.js` |
| `fantracking/warnings/monthly.js` | `Broadcast/Inspector/monthlyWarningInspector.js` |

> `fantracking/milestone/eval.js` moves to `Refinery/Refiner/milestoneEval.js` — the
> eligibility *calculation* is Refinery work. Broadcast/Inspector calls the Refiner result;
> it does not re-implement the calculation.

**Archive:**

| Current path | Target path |
|---|---|
| `fantracking/milestone/db.js` | `Broadcast/Archive/milestoneArchive.js` |
| `fantracking/warnings/db.js` | `Broadcast/Archive/warningArchive.js` |
| `fantracking/achievements/db.js` | `Broadcast/Archive/achievementArchive.js` |

**Announcer (delivery portions only — see §4.2 for the render split):**

| Source | Target path |
|---|---|
| Delivery portion of `fantracking/milestone/notifier.js` | `Broadcast/Announcer/milestoneAnnouncer.js` |
| Delivery portion of `fantracking/leaderboard/announcements.js` | `Broadcast/Announcer/leaderboardAnnouncer.js` |
| Delivery portion of `fantracking/warnings/imageReport.js` | `Broadcast/Announcer/warningAnnouncer.js` |
| `tasks/fanDeficitImageReport.js` (delivery part) | `Broadcast/Announcer/fanDeficitAnnouncer.js` |

---

### 4.4 Shims to create or update

After physical moves, every shim that currently points into `fantracking/` or `tasks/`
updates its target. No command, handler, or task import path changes from the outside.

**Shims in `core/` — update target:**

| File | New target |
|---|---|
| `core/umaStats.js` | `Refinery/Refiner/umaStats.js` |
| `core/milestoneEval.js` | `Refinery/Refiner/milestoneEval.js` |
| `core/fanDeficitApi.js` | `Workshop/Terminal/fanDeficitApi.js` |

**Shims in `db/` — update target:**

| File | New target |
|---|---|
| `db/linksDb.js` | `Refinery/Depot/linksDb.js` |
| `db/leaderboardSnapshotDb.js` | `Refinery/Depot/leaderboardSnapshotDb.js` |
| `db/achievementDb.js` | `Broadcast/Archive/achievementArchive.js` |
| `db/milestoneDb.js` | `Broadcast/Archive/milestoneArchive.js` |
| `db/warningDb.js` | `Broadcast/Archive/warningArchive.js` |

**Shims in `tasks/` — update target:**

| File | New target |
|---|---|
| `tasks/dataSync.js` | `Refinery/Compiler/dataSync.js` |
| `tasks/warningEngine.js` | `Broadcast/Inspector/warningInspector.js` |
| `tasks/dailyFanWarning.js` | `Broadcast/Inspector/dailyWarningInspector.js` |
| `tasks/monthlyWarning.js` | `Broadcast/Inspector/monthlyWarningInspector.js` |
| `tasks/weeklyWarning.js` | `Broadcast/Inspector/weeklyWarningInspector.js` |
| `tasks/milestones.js` | `Broadcast/Broker/milestoneBroker.js` |
| `tasks/milestone-tiers.js` | `Broadcast/Inspector/milestoneTiers.js` |
| `tasks/milestoneCleanup.js` | `Broadcast/Inspector/milestoneCleanup.js` |
| `tasks/milestoneWinners.js` | `Broadcast/Inspector/milestoneWinners.js` |
| `tasks/dailyAchievement.js` | `Broadcast/Broker/achievementBroker.js` |
| `tasks/leaderboardAnnouncements.js` | `Broadcast/Announcer/leaderboardAnnouncer.js` |
| `tasks/interCircleAnnouncements.js` | `Broadcast/Broker/interCircleBroker.js` |
| `tasks/fanDeficitImageReport.js` | `Broadcast/Announcer/fanDeficitAnnouncer.js` |
| `tasks/weeklyAnnouncement.js` | `Broadcast/Broker/weeklyAnnouncementBroker.js` |

**Shims in `utils/reports/` — update target:**

All 16 files update re-export target from `fantracking/reports/<file>` → `Workshop/Fabricator/reports/<file>`:

```
utils/reports/fanGain.js        utils/reports/milestone.js
utils/reports/leaderboard.js    utils/reports/fanDeficit.js
utils/reports/circleMaster.js   utils/reports/warnings.js
utils/reports/dailyFanWarning.js utils/reports/warningCard.js
utils/reports/dailyAchievement.js utils/reports/greeting.js
utils/reports/help.js           utils/reports/joindate.js
utils/reports/profile.js        utils/reports/store.js
utils/reports/timeline.js       utils/reports/linkList.js
```

**Shim to update in `utils/`:**

| File | New target |
|---|---|
| `utils/milestoneNotifier.js` | `Broadcast/Announcer/milestoneAnnouncer.js` |

---

### 4.5 New files to create

**Broadcast department sub-files (assimilation targets):**

```
Broadcast/Broker/milestoneBroker.js
Broadcast/Broker/greetingBroker.js
Broadcast/Broker/dailyMessageBroker.js
Broadcast/Broker/offlineCheckBroker.js
Broadcast/Broker/weeklyAnnouncementBroker.js
Broadcast/Broker/interCircleBroker.js
Broadcast/Broker/achievementBroker.js

Broadcast/Inspector/milestoneTiers.js
Broadcast/Inspector/milestoneWinners.js
Broadcast/Inspector/milestoneCleanup.js
Broadcast/Inspector/warningInspector.js
Broadcast/Inspector/dailyWarningInspector.js
Broadcast/Inspector/weeklyWarningInspector.js
Broadcast/Inspector/monthlyWarningInspector.js

Broadcast/Archive/milestoneArchive.js
Broadcast/Archive/warningArchive.js
Broadcast/Archive/achievementArchive.js

Broadcast/Announcer/milestoneAnnouncer.js
Broadcast/Announcer/leaderboardAnnouncer.js
Broadcast/Announcer/warningAnnouncer.js
Broadcast/Announcer/fanDeficitAnnouncer.js
```

**Workshop Fabricator renders (split from mixed files):**

```
Workshop/Fabricator/renders/leaderboard.js
Workshop/Fabricator/renders/milestone.js
Workshop/Fabricator/renders/warningReport.js
Workshop/Fabricator/reports/   (17 report files from fantracking/reports/)
```

---

### 4.6 Files that do not change

**Umamoe pipeline departments (all stay):**
```
umamoe/Miner/miner.js
umamoe/Courier/courier.js
umamoe/Inspector/inspector.js
umamoe/Vault/vault.js, umamoe/Vault/adapters/
umamoe/history/*, umamoe/timeline/*, umamoe/trainer/*
umamoe/profileBackfill.js, umamoe/index.js
```

**Umamoe legacy (stay until absorbed):**
```
umamoe/umaClient.js, umamoe/umaCache.js
umamoe/umaQueue.js, umamoe/uma.js
```

**Core support utilities (permanent):**
```
core/config.js      core/log.js         core/store.js
core/format.js      core/errors.js      core/channels.js
core/channel-utils.js  core/channelPerms.js  core/busyLock.js
core/quotaKeys.js   core/taskRegistry.js  core/health.js
core/tally.js       core/monthlyHistory.js  core/tokenLoader.js
core/docsStudio.js  core/reportStudio.js  core/slidesStudio.js
core/deploy-commands.js
```

**Core shims for Umamoe (target unchanged until absorption):**
```
core/uma.js, core/umaClient.js, core/umaCache.js, core/umaQueue.js
```

**DB support (logic unchanged; some shim targets update):**
```
db/migrations.js        db/storeDb.js         db/trainerColorDb.js
db/trainerDb.js         db/onboardingDb.js    db/attendanceDb.js
db/imageArchiveDb.js    db/circleDb.js        db/profileSyncDb.js
db/stadiumDb.js         db/historicalCacheDb.js  db/timelineCache.js
```

**Utils support (permanent):**
```
utils/dm.js             utils/updateLog.js    utils/autoDelete.js
utils/imageReport.js    utils/imageReport-browser.js
utils/imageClassifier.js  utils/activityLog.js  utils/changelog.js
utils/characterData.js  utils/cardCache.js    utils/verificationHelper.js
```

**Utils shims for Umamoe (target unchanged):**
```
utils/pastHistoryReader.js, utils/generatePastHistoryMd.js
utils/profileBackfill.js, utils/resumeCard.js, utils/skillScraper.js
```

**Commands, handlers, onboarding — none change:**
```
commands/*.js   (26 slash command files)
handlers/*.js   (6 event handlers + handlers/features/)
onboarding/*.js (handler.js, reminder.js, db.js)
```

**Tasks that are scheduler entry points or independent subsystems — stay:**
```
tasks/index.js              (cron scheduler — calls into Broker; stays as entry point)
tasks/historicalSync.js     (self-contained; stays)
tasks/attendanceCheck.js    (self-contained subsystem; stays)
tasks/chatArchiver.js       tasks/imageArchive.js
tasks/memberArchive.js      tasks/messageCleanup.js
tasks/monthlyHistoryExport.js  tasks/nameLinker.js
tasks/onboardingReminder.js tasks/purgeAnnouncement.js
tasks/sqliteBackup.js       tasks/stadiumSync.js
tasks/startupMigrations.js  tasks/tallyResults.js
tasks/timezoneNotice.js     tasks/updateGameData.js
tasks/autoBackfill.js       tasks/autoImportCsv.js
tasks/purgeUmaStore.js
```

**fantracking/ files that stay (independent subsystems):**
```
fantracking/attendance/check.js   (attendance tracking — not fan-gain domain)
fantracking/attendance/db.js
fantracking/milestone/images.js   (image pool loader — stays; referenced by Announcer)
fantracking/leaderboard/interCircle.js  (inter-circle data; Broker picks up trigger logic)
```

---

## 5. Implementation Order

Each task is isolated. The bot must remain fully operational after every step.
File-move tasks are pure copy + shim-retarget — zero logic changes, zero risk.

| Task | Action | Status | Risk |
|---|---|---|---|
| **A** | Broadcast spec docs in repo | ✅ DONE | None |
| **B** | Workshop spec docs + all blueprints in repo | ✅ DONE | None |
| **C** | Refinery spec docs in repo | ✅ DONE | None |
| **D** | Refinery department .js files created (`refiner.js`, `compiler.js`, `depot.js`) | ✅ DONE | None |
| **E** | Workshop department .js files created (`draftsman.js`, `fabricator.js`, `Validator.js`, `terminal.js`) | ✅ DONE | None |
| **F** | Broadcast department .js files created (`broker.js`, `archive.js`, `announcer.js`, `archiveInspector.js`) | ✅ DONE | None |
| **1** | Move Refinery/Refiner files (`umaStats`, `velocity`, `achievements`, `milestoneEval`); update shims in `core/`, `tasks/` | Pending | Low |
| **2** | Move Refinery/Compiler files (`dataSync`, `circleQueue`, `aggregation`); update shims in `tasks/` | Pending | Low |
| **3** | Move Refinery/Depot files (`linksDb`, `linksRepository`, `leaderboardSnapshotDb`); update shims in `db/` | Pending | Low |
| **4** | Move Workshop/Fabricator report files (17 files from `fantracking/reports/`); update shims in `utils/reports/` | Pending | Low |
| **5** | Move `Workshop/Terminal/fanDeficitApi.js`; update shim in `core/` | Pending | Low |
| **6** | Move Broadcast/Inspector files (7 warning + milestone files); update shims in `tasks/` | Pending | Low |
| **7** | Move Broadcast/Archive files (`milestone/db`, `warnings/db`, `achievements/db`); update shims in `db/` | Pending | Low |
| **8** | Split render/delivery in `milestone/notifier.js`, `leaderboard/announcements.js`, `warnings/imageReport.js`; render → `Workshop/Fabricator/renders/`, delivery → `Broadcast/Announcer/` | Pending | Medium |
| **9** | Move Broadcast/Broker files (orchestrators from `tasks/` and `fantracking/`); update shims in `tasks/` | Pending | Low |
| **10** | Wire `Refinery/Refiner/refiner.js` to call assimilated files end-to-end | Pending | Medium |
| **11** | Wire `Refinery/Compiler/compiler.js` to call assimilated files end-to-end | Pending | Medium |
| **12** | Wire `Refinery/Depot/depot.js` + SQLite adapter end-to-end | Pending | Medium |
| **13** | Wire `Broadcast/Archive/archive.js` unified interface | Pending | Medium |
| **14** | Wire `Broadcast/Inspector/inspector.js` (archiveInspector) unified eligibility interface | Pending | Medium |
| **15** | Wire `Broadcast/Broker/broker.js` unified entry point | Pending | Medium |
| **16** | Wire `Broadcast/Announcer/announcer.js` unified delivery interface | Pending | Medium |
| **17** | Wire `fantracking/sync/dataSync.js` to use Refinery pipeline end-to-end | Pending | High |
| **18** | Formalize `Distribution/` directory (`Retriever/`, `Dispatcher/`) | Pending | Medium |

After task 9, `fantracking/` retains only `attendance/`, `milestone/images.js`, and `leaderboard/interCircle.js`.
It can be formally retired after those are confirmed as standalone or relocated.
