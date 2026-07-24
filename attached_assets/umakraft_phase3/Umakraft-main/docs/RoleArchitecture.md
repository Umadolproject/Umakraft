# UmaKraft Circle Bot — Role Architecture

**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**References:** `PIPELINE_REGISTRY.md`, `PIPELINE_OPERATIONS.md`, `PIPELINE_EVOLUTION.md`, `ARCHITECTURE_DECISIONS.md`
**Version:** 2.0.0
**Last Updated:** 2026-07-19

This document defines the role of every major directory in the UmaKraft pipeline architecture,
the boundaries each directory must respect, and the full data pipeline.

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
3. [Boundary Rules](#3-boundary-rules)

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

| Department | Responsibility |
|---|---|
| Miner | HTTP requests to approved uma.moe endpoints only; rate-limiting; exponential backoff retry |
| Courier | Transports Miner output to Inspector unchanged; basic transportability checks only |
| Inspector | Validates structure, completeness, types, and ranges; accepts or rejects; does not modify |
| Vault | Stores accepted trusted envelopes; provides retrieval to Refinery only |

**May:**
- Fetch from approved endpoints (`umamoe/MINER_ENDPOINTS.md`)
- Validate raw API response shape
- Store `{ trustedData, metadata }` envelopes

**Must not:**
- Compute fan gains, trends, rankings, or any derived value
- Render Discord embeds or image cards
- Write to databases outside `Vault/`
- Send anything to Discord

**Specification documents:**

- `umamoe/Miner/Miner.md` — Miner department spec
- `umamoe/Courier/Courier.md` — Courier department spec
- `umamoe/Inspector/Inspector.md` — Inspector department spec (rules: `Inspector/VALIDATION_RULES.md`)
- `umamoe/Vault/Vault.md` — Vault department spec

---

### 2.2 `Refinery/` — Computed Data Pipeline

**One sentence:** Reads trusted data from the Vault, applies business logic and calculations,
assembles finished products, and stores them in the Depot.

**Departments:**

| Department | Responsibility |
|---|---|
| Refiner | Domain calculations: fan gain deltas, trends, pace flags, milestone eligibility, achievement checks |
| Compiler | Assembles multiple `refinedResult` envelopes from the Refiner into a single `compiledProduct` |
| Depot | Persists compiled products with `id` and `version`; serves Workshop and Broadcast on request |

**May:**
- Read from `Vault` (read-only; must not write to Vault)
- Compute derived values: daily/weekly/monthly fan gains, velocity, pace, quotas, trends, flags
- Assemble and store compiled products in `Depot`

**Must not:**
- Fetch data from uma.moe directly
- Store raw API payloads
- Render Discord embeds or image cards
- Send anything to Discord

**Spec docs:**

```
Refinery/README.md
Refinery/Overview.md
Refinery/Refiner/Refiner.md
Refinery/Compiler/Compiler.md
Refinery/Depot/Depot.md
```

---

### 2.3 `Workshop/` — Deliverable Manufacturing

**One sentence:** Retrieves compiled products from the Depot, manufactures user-facing Discord
deliverables following per-command blueprints, validates them, and hands them to Distribution.

**Departments:**

| Department | Responsibility |
|---|---|
| Draftsman | Defines and manages the specification (layout, fields, visual rules) for each deliverable type |
| Fabricator | Constructs the deliverable (Discord embed + image card) from a blueprint and compiled product |
| Validator | Checks the deliverable against its blueprint spec; approves or rejects before release |
| Terminal | Immutable staging area for approved deliverables awaiting Distribution pickup |

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
> delivers that rendered product to Discord with dedup and retry tracking. Any component
> that handles both rendering and delivery must be split: render logic goes to Fabricator,
> delivery logic goes to Announcer.

**Spec docs:**

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

| Department | Responsibility |
|---|---|
| Broker | Triggered by cron or threshold; fetches compiled data from Refinery/Depot; manages per-circle queue; on restart reads Archive for incomplete records and routes to Announcer |
| Inspector | Receives raw data from Broker; runs eligibility, dedup, recipient resolution, variant selection; if approved: writes full notification record to Archive; if rejected: drops cleanly |
| Archive | Pure storage. Holds notification records and delivery state. Written by Inspector (new records) and Announcer (flag updates). Read by Announcer (delivery plan) and Broker (incomplete records on restart) |
| Announcer | Reads full notification record from Archive by notificationKey; renders image card via Workshop/Fabricator; posts to channel; sends member DMs; sends leader DM; updates each delivery flag in Archive on success |

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

**Spec docs:**

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


---

### 2.5 `Distribution/` — Command Response Routing

**One sentence:** Retrieves approved deliverables from Workshop/Terminal and routes them
to the correct Discord destination in response to a user slash command.

**Status: PENDING FORMALIZATION**

**Planned departments:**

| Department | Responsibility |
|---|---|
| Retriever | Pulls approved deliverables from Workshop/Terminal |
| Dispatcher | Routes the deliverable to the correct Discord channel, user DM, or command reply |

> Distribution is formalized as a later-stage task after Refinery, Workshop, and Broadcast departments are fully established.

---

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

