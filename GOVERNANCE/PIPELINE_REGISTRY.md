# PIPELINE_REGISTRY.md

**Document Status:** Official Pipeline Registry
**Authority Level:** Constitutional Registry
**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**Version:** 1.0.0
**Last Updated:** 2026-07-19

---

# Purpose

The Pipeline Registry is the official catalogue of every architectural department within this repository.

Its purpose is to establish ownership, define responsibilities, document interfaces, and preserve architectural boundaries.

Every component registered here is considered an official department of the UmaKraft architecture.

This registry is the authoritative source for determining where new functionality belongs.

---

# Repository Pipeline

```text
Repository

    ▼

Umamoe
    ▼
Refinery
    ▼
Workshop
    ▼
Distribution
    ▼
Broadcast
```

Every stage has a defined purpose.

No stage may bypass another without explicit architectural approval.

---

# Ownership Rules

Each department has one owner.

Each responsibility has one owner.

One responsibility must never have multiple architectural owners.

If a responsibility already exists inside a department, new implementations shall extend that department rather than duplicate it elsewhere.

---

# ============================================================

# STAGE 1 — UMAMOE

# ============================================================

## Miner

### Purpose

Acquire raw external information.

### Owns

* API communication
* Data extraction
* Scraping
* Remote endpoints
* Request scheduling
* Raw response collection

### Receives

* Feature requests
* Extraction jobs

### Produces

* Raw Data Envelope

### Never Owns

* Validation
* Persistence
* Rendering
* Discord
* Notifications

### Downstream

Courier

### Implementation

* `umamoe/Miner/miner.js` — HTTP requests to uma.moe endpoints; rate-limit queue; exponential backoff retry
* `umamoe/umaClient.js` — legacy HTTP client (pending absorption into Miner)
* `umamoe/umaQueue.js` — legacy rate-limit logic (pending absorption into Miner)
* Endpoint registry: `umamoe/MINER_ENDPOINTS.md`
* Status: **IMPLEMENTED**
* Version: 1.0.0

---

## Courier

### Purpose

Transport pipeline data.

### Owns

* Envelope routing
* Pipeline transport
* Queue transfer
* Data forwarding

### Receives

Raw Data Envelope

### Produces

Transport Envelope

### Never Owns

* Business rules
* Validation
* Storage
* Rendering

### Downstream

Inspector

### Implementation

* `umamoe/Courier/courier.js` — transports Miner output to Inspector unchanged; basic transportability checks only
* Status: **IMPLEMENTED**
* Version: 1.0.0

---

## Inspector

### Purpose

Validate incoming pipeline data.

### Owns

* Validation
* Schema verification
* Required fields
* Data integrity
* Error classification

### Receives

Transport Envelope

### Produces

Validated Envelope

### Never Owns

* Storage
* Rendering
* Notifications
* Database writes

### Downstream

Vault

### Implementation

* `umamoe/Inspector/inspector.js` — validates structure, completeness, types, and ranges; accepts or rejects; does not modify
* `umamoe/Inspector/VALIDATION_RULES.md` — field-level validation rule definitions
* Status: **IMPLEMENTED**
* Version: 1.0.0

---

## Vault

### Purpose

Trusted persistence layer.

### Owns

* Storage
* Persistence
* Recovery
* Version history
* Snapshot management

### Receives

Validated Envelope

### Produces

Trusted Pipeline Record

### Never Owns

* Validation
* Rendering
* Notifications
* API requests

### Downstream

Refinery

### Implementation

* `umamoe/Vault/vault.js` — stores accepted trusted envelopes; provides retrieval to Refinery only
* `umamoe/Vault/adapters/inmemory.js` — in-memory storage adapter
* `umamoe/Vault/adapters/file.js` — file-based storage adapter
* `umamoe/umaCache.js` — legacy in-memory adapter (pending absorption into Vault)
* `umamoe/uma.js` — legacy barrel (buildSnapshot, getCircleSnapshot — pending absorption into Vault)
* Status: **IMPLEMENTED**
* Version: 1.0.0

---

# ============================================================

# STAGE 2 — REFINERY

# ============================================================

## Refiner

### Purpose

Transform trusted records into refined domain information.

### Owns

* Normalization
* Cleaning
* Derived values
* Domain refinement

### Receives

Trusted Pipeline Record

### Produces

Refined Result

### Implementation

* `Refinery/Refiner/refiner.js` — domain calculations entry point
* Pending assimilation: `umamoe/umaStats.js` (fan delta computation — misplaced in Umamoe), `fantracking/velocity/index.js` (rolling 7-day avg + projection), `fantracking/milestone/eval.js` (milestone tier eligibility)
* Status: **IMPLEMENTED** (assimilation in progress)
* Version: 1.0.0

---

## Compiler

### Purpose

Assemble refined results into canonical products.

### Owns

* Product assembly
* Merge rules
* Provenance
* Canonical schemas
* Product generation

### Receives

Refined Result

### Produces

Compiled Product

### Implementation

* `Refinery/Compiler/compiler.js` — assembles multiple refinedResult envelopes into a single compiledProduct
* Pending assimilation: `fantracking/sync/dataSync.js` (full sync orchestration), `fantracking/sync/circleQueue.js` (per-circle queue management), `fantracking/aggregation/index.js` (weekly/monthly aggregate assembly)
* Status: **IMPLEMENTED** (assimilation in progress)
* Version: 1.0.0

---

## Depot

### Purpose

Store compiled products.

### Owns

* Product persistence
* Retrieval
* Version lookup
* Product retention

### Receives

Compiled Product

### Produces

Stored Product

### Consumers

Workshop

Broadcast

### Implementation

* `Refinery/Depot/depot.js` — persists compiled products with id and version; serves Workshop and Broadcast on request
* Pending assimilation: `fantracking/leaderboard/snapshotDb.js` (leaderboard snapshot persistence), `fantracking/links/db.js` (trainer ↔ Discord identity store), `fantracking/links/repository.js` (links data access layer)
* Shims pointing here: `db/linksDb.js`, `db/leaderboardSnapshotDb.js`
* Status: **IMPLEMENTED** (assimilation in progress)
* Version: 1.0.0

---

# ============================================================

# STAGE 3 — WORKSHOP

# ============================================================

## Workshop

### Purpose

Generate presentation artifacts.

### Owns

* Rendering
* Templates
* Cards
* Images
* Embeds
* Reports

### Receives

Compiled Product

### Produces

Presentation Assets

### Never Owns

* API extraction
* Validation
* Notification decisions

### Departments

| Department | File | Responsibility |
|---|---|---|
| Draftsman | `Workshop/Draftsman/draftsman.js` | Manages blueprint specs for each deliverable type; blueprint definitions in `Workshop/Draftsman/Blueprint/` |
| Fabricator | `Workshop/Fabricator/fabricator.js` | Constructs Discord embeds and image cards from a blueprint and compiled product |
| Validator | `Workshop/Validator/Validator.js` | Checks deliverable against its blueprint spec; approves or rejects before release |
| Terminal | `Workshop/Terminal/terminal.js` | Immutable staging area for approved deliverables awaiting Distribution pickup |

### Implementation

* `Workshop/Draftsman/draftsman.js` — blueprint management
* `Workshop/Draftsman/Blueprint/` — 16 blueprint specs: `leaderboard.md`, `milestone.md`, `warning.md`, `greeting.md`, `help.md`, `total_fan.md`, `circle_master.md`, `joindate.md`, `store.md`, `timeline.md`, `fan_gain.md`, `profile.md`, `circle.md`, `link.md`, `set_fans.md`, `club_gain.md`
* `Workshop/Fabricator/fabricator.js` — deliverable construction
* `Workshop/Validator/Validator.js` — deliverable validation
* `Workshop/Terminal/terminal.js` — approved deliverable staging
* Pending assimilation: `fantracking/reports/*.js` (17 render files) → `Workshop/Fabricator/reports/`; render portions of `fantracking/leaderboard/announcements.js`, `fantracking/milestone/notifier.js`, `fantracking/warnings/imageReport.js` → `Workshop/Fabricator/renders/`
* Shims pointing here: `utils/reports/*.js` (16 shim files)
* Status: **IMPLEMENTED** (report assimilation in progress)
* Version: 1.0.0

---

# ============================================================

# STAGE 4 — DISTRIBUTION

# ============================================================

## Discord

### Purpose

Own the raw Discord API surface — all files that originate directly from or are registered directly with the Discord API.

### Owns

* Discord gateway event handlers
* Slash command definitions and registrations
* Discord client startup bindings
* Shared Discord platform utilities (permission helpers, embed builders, rate-limit guards)

### Receives

Raw Discord gateway events from the Discord API

### Produces

* Forwarded interaction events passed to Commands
* Slash command definitions registered with the Discord API
* Shared Discord utilities consumed by Commands and Dispatcher

### Never Owns

* Business logic
* Input validation
* Pipeline orchestration
* Response delivery
* Data persistence

### Downstream

Commands

### Implementation

* `Distribution/Discord/events/` — one file per Discord gateway event
* `Distribution/Discord/commands/` — one file per slash command definition
* Status: **FORMALIZED**
* Version: 1.0.0

---

## Commands

### Purpose

Receive Discord slash commands, validate input, and route to Coordinator.

### Owns

* Slash command intake
* Input validation
* Permission checks
* Command-to-Coordinator routing

### Receives

Discord slash command interaction event

### Produces

Validated command payload

### Never Owns

* Pipeline orchestration
* Business logic
* Discord response delivery
* Data persistence
* Rendering

### Downstream

Coordinator

### Implementation

* `Distribution/Commands/` — per-command handlers
* Status: **FORMALIZED**
* Version: 1.0.0

---

## Coordinator

### Purpose

Orchestrate pipeline execution per command and retrieve finished deliverables.

### Owns

* Pipeline orchestration per command
* Umamoe, Refinery, Workshop call sequencing
* Error handling and retry policy
* Deliverable retrieval from Workshop/Terminal

### Receives

Validated command payload (from Commands)

### Produces

Finished deliverable or structured error envelope

### Never Owns

* Discord event intake
* Input validation
* Discord response delivery
* Rendering logic
* Business logic belonging to Refinery

### Downstream

Dispatcher

### Implementation

* `Distribution/Coordinator/` — per-command orchestration actions
* Status: **FORMALIZED**
* Version: 1.0.0

---

## Dispatcher

### Purpose

Deliver finished deliverables to the correct Discord destination.

### Owns

* Discord destination resolution (channel, DM, ephemeral, thread)
* Discord payload formatting (embed, image attachment, plain message)
* Discord API delivery
* User-facing error message formatting

### Receives

Finished deliverable or error envelope (from Coordinator)

### Produces

Discord message, embed, or image attachment delivered to user

### Never Owns

* Pipeline orchestration
* Command intake
* Business logic
* Data transformation
* Content modification of deliverables

### Downstream

User (Discord)

### Implementation

* `Distribution/Dispatcher/` — destination resolvers and delivery handlers
* Status: **FORMALIZED**
* Version: 1.0.0

---

# ============================================================

# STAGE 5 — BROADCAST

# ============================================================

## Broker

### Purpose

Broadcast entry point.

### Owns

* Scheduled triggers
* Queue management
* Data retrieval
* Notification job creation

### Receives

Trigger

### Produces

Notification Envelope

### Never Owns

Eligibility

Decision making

### Implementation

* `Broadcast/Broker/broker.js` — orchestration entry point; triggered by cron or threshold event; fetches compiled data from Refinery/Depot via registered fetch handlers; on restart reads Archive for incomplete records and routes to Archive-Transporter (bypassing Archive-Inspector)
* `Broadcast/pipeline.js` — public entry surface; re-exports run/recoverIncomplete/registerFetch/setConfiguredCircles
* Pending assimilation: `fantracking/milestone/milestones.js`, `tasks/dailyGreetingReport.js`, `tasks/dailyMessages.js`, `tasks/offlineCheck.js`, `tasks/weeklyAnnouncement.js`, `tasks/interCircleAnnouncements.js`
* Shims pointing here: `tasks/milestones.js`, `tasks/interCircleAnnouncements.js`, `tasks/weeklyAnnouncement.js`
* Status: **IMPLEMENTED** (assimilation in progress)
* Version: 2.0.0

---

## Broadcast Inspector

### Purpose

Notification approval authority.

### Owns

* Eligibility
* Deduplication
* Recipient resolution
* Variant selection
* Archive creation

### Receives

Notification Envelope

### Produces

Approved Notification

### Never Owns

Discord delivery

### Implementation

* `Broadcast/archive-inspector/archiveInspector.js` — six-step evaluation: eligibility → dedup → recipient resolution → variant selection → Archive write → Archive-Transporter signal; uses type registry (registerType); sole writer to Archive
* Pending assimilation: `fantracking/milestone/tiers.js`, `fantracking/milestone/winners.js`, `fantracking/milestone/cleanup.js`, `fantracking/warnings/engine.js`, `fantracking/warnings/daily.js`, `fantracking/warnings/weekly.js`, `fantracking/warnings/monthly.js`
* Shims pointing here: `tasks/warningEngine.js`, `tasks/dailyFanWarning.js`, `tasks/weeklyWarning.js`, `tasks/monthlyWarning.js`, `tasks/milestone-tiers.js`, `tasks/milestoneCleanup.js`, `tasks/milestoneWinners.js`
* Status: **IMPLEMENTED** (assimilation in progress)
* Version: 2.0.0

---

## Archive

### Purpose

Persistent notification storage.

### Owns

* Notification records
* Delivery state
* Retry state
* History

### Receives

Approved Notification

### Produces

Stored Notification

### Implementation

* `Broadcast/Archive/archive.js` — pure storage; adapter pattern (in-memory for tests, SQLite for production); sole record creator is Archive-Inspector; sole flag updater is Announcer; sole incomplete-record reader is Broker; sole SELECT-by-key caller is Archive-Transporter
* `Broadcast/Archive/adapters/memoryAdapter.js` — in-memory adapter (development and tests)
* `Broadcast/archive_transporter/archiveTransporter.js` — fetch-and-handoff stage; receives notificationKey from Archive-Inspector or Broker; fetches full record from Archive; validates and passes to Announcer
* Schema: `broadcast_claims` (one record per event, INSERT OR IGNORE) + `broadcast_history` (append-only delivery log)
* Pending assimilation: `fantracking/milestone/db.js`, `fantracking/warnings/db.js`, `fantracking/achievements/db.js`
* Shims pointing here: `db/milestoneDb.js`, `db/warningDb.js`, `db/achievementDb.js`
* Status: **IMPLEMENTED** (assimilation in progress; SQLite adapter pending)
* Version: 2.0.0

---

## Announcer

### Purpose

Deliver approved notifications.

### Owns

* Discord delivery
* Retry execution
* Delivery status
* Completion updates

### Receives

Stored Notification (pre-fetched record from Archive-Transporter)

### Produces

Delivered Notification

### Implementation

* `Broadcast/Announcer/announcer.js` — receives full pre-fetched record from Archive-Transporter; checks each delivery flag before acting; renders image card via Workshop/Fabricator; posts to channel; sends member DMs; sends leader DM; updates each flag in Archive on success; also exposes announceOperationAlert() for Operation/Manager fire-and-forget alerts
* Pending assimilation: delivery portions of `fantracking/milestone/notifier.js`, `fantracking/leaderboard/announcements.js`, `fantracking/warnings/imageReport.js`, `tasks/fanDeficitImageReport.js`
* Shims pointing here: `utils/milestoneNotifier.js`, `tasks/leaderboardAnnouncements.js`, `tasks/fanDeficitImageReport.js`
* Status: **IMPLEMENTED** (assimilation in progress)
* Version: 2.0.0

---

# Architectural Ownership Matrix

| Responsibility        | Owner               |
| --------------------- | ------------------- |
| API Extraction        | Miner               |
| Raw Transport         | Courier             |
| Validation            | Inspector           |
| Trusted Storage       | Vault               |
| Data Refinement       | Refiner             |
| Product Assembly      | Compiler            |
| Product Storage       | Depot               |
| Rendering             | Workshop            |
| Application Routing   | Distribution        |
| Broadcast Trigger     | Broker              |
| Notification Approval | Broadcast Inspector |
| Notification Archive  | Archive             |
| Discord Delivery      | Announcer           |

---

# Dependency Contract

Every department may only communicate with approved architectural neighbors.

Forward movement is encouraged.

Backward ownership is prohibited.

Allowed

```text
Miner
    ↓
Courier
    ↓
Inspector
    ↓
Vault
```

Allowed

```text
Compiler
    ↓
Depot
```

Allowed

```text
Broker
    ↓
Broadcast Inspector
    ↓
Archive
    ↓
Announcer
```

Forbidden

```text
Workshop
    ↓
Miner
```

Forbidden

```text
Vault
    ↓
Workshop
```

Forbidden

```text
Announcer
    ↓
Inspector
```

---

# Pipeline Expansion Rules

New departments may only be introduced when:

* no existing department owns the responsibility,
* ownership is clearly defined,
* dependencies remain directional,
* the Repository Owner approves the addition,
* the new department is registered here before implementation.

---

# Registration Template

Every new department must include:

```text
Department Name:

Stage:

Purpose:

Owner:

Inputs:

Outputs:

Interfaces:

Dependencies:

Consumers:

Protected:

Version:

Status:
```

---

# Registry Compliance Checklist

Before implementing any feature, verify:

* [ ] Correct owner identified.
* [ ] No duplicate responsibility exists.
* [ ] Dependencies remain directional.
* [ ] Interfaces are documented.
* [ ] Downstream consumers are identified.
* [ ] No protected department is modified.
* [ ] Registry updated if architecture changes.

---

# Registry Maintenance

This document is maintained by the Repository Owner.

Any architectural modification affecting ownership, interfaces, responsibilities, or dependencies must update this registry.

Changes to this registry must also be recorded in `ARCHITECTURE_DECISIONS.md`.

Failure to update this registry results in the architecture being considered out of compliance.

---

# Final Statement

The Pipeline Registry is the architectural map of the repository.

It defines ownership before implementation, responsibility before code, and structure before expansion.

Every feature begins here.

Every architectural decision is validated against this registry.

If the registry and implementation disagree, the registry is considered the intended architecture until an approved amendment updates both.
