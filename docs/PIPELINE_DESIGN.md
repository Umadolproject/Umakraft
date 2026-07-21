# PIPELINE SYSTEM

**Document Status:** Single Source of Truth — Pipeline Construction  
**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`  
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`  
**Operations:** `GOVERNANCE/PIPELINE_OPERATIONS.md`  
**Version:** 1.0.0  
**Last Updated:** 2026-07-21  

---

## What This Document Is

This document defines **how the UmaKraft pipeline is built** — end to end, stage by stage, handoff by handoff.

It is the single source of truth for pipeline construction. When this document and any other document disagree on how the pipeline flows, **this document governs**.

It does not replace the governance documents. It is grounded in them. Every rule here derives from `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` and every department registered here matches `GOVERNANCE/PIPELINE_REGISTRY.md`. If a contradiction appears between this document and the governance, raise an Architecture Decision — do not silently override either.

Read this document before writing any code that touches more than one stage. Read the relevant stage section before writing code inside a single stage.

---

## Pipeline at a Glance

UmaKraft has **five pipeline stages** and **two delivery paths** that both originate from Refinery/Depot.

```text
                        ┌─────────────────────────────┐
                        │        uma.moe API           │
                        └──────────────┬──────────────┘
                                       │
                               ┌───────▼───────┐
                               │  STAGE 1      │
                               │   UMAMOE      │
                               │               │
                               │ Miner         │
                               │   ↓           │
                               │ Courier       │
                               │   ↓           │
                               │ Inspector     │
                               │   ↓           │
                               │ Vault         │
                               └───────┬───────┘
                                       │ Trusted Pipeline Record
                               ┌───────▼───────┐
                               │  STAGE 2      │
                               │   REFINERY    │
                               │               │
                               │ Refiner       │
                               │   ↓           │
                               │ Compiler      │
                               │   ↓           │
                               │ Depot         │
                               └───────┬───────┘
                                       │ Compiled Product
                          ┌────────────┴────────────┐
                          │                         │
               ┌──────────▼──────────┐   ┌──────────▼──────────┐
               │  STAGE 3            │   │  STAGE 5            │
               │  WORKSHOP           │   │  BROADCAST          │
               │  (command path)     │   │  (notification path)│
               │                     │   │                     │
               │ Draftsman           │   │ Broker              │
               │   ↓                 │   │   ↓                 │
               │ Fabricator          │   │ Archive-Inspector   │
               │   ↓                 │   │   ↓                 │
               │ Validator           │   │ Archive             │
               │   ↓                 │   │   ↓                 │
               │ Terminal            │   │ Archive-Transporter │
               └──────────┬──────────┘   │   ↓                 │
                          │              │ Announcer           │
               ┌──────────▼──────────┐   └──────────┬──────────┘
               │  STAGE 4            │              │
               │  DISTRIBUTION       │              │
               │  (pending formal)   │              │
               │                     │              │
               │ Retriever           │              │
               │   ↓                 │              │
               │ Dispatcher          │              │
               └──────────┬──────────┘              │
                          │                         │
                          └────────────┬────────────┘
                                       │
                               ┌───────▼───────┐
                               │    Discord    │
                               └───────────────┘
```

---

## The Two Delivery Paths

Refinery/Depot is the fork point. Every piece of data that reaches Discord does so through exactly one of two paths.

### Command Path (Stages 1 → 2 → 3 → 4)

**Trigger:** A user runs a Discord slash command.  
**Flow:** Depot → Workshop → Distribution → Discord  
**Character:** Stateless, single recipient, on-demand, no deduplication needed.  
**Ownership of delivery:** Distribution.

### Notification Path (Stages 1 → 2 → 5)

**Trigger:** A cron schedule fires or a data threshold is crossed.  
**Flow:** Depot → Broadcast → Discord  
**Character:** Stateful, many recipients (channel + N member DMs + leader DM), scheduled, deduplication is critical, restart-safe.  
**Ownership of delivery:** Broadcast/Announcer.

**Rule:** Broadcast never triggers from a user command. Distribution never fires automatic notifications. These paths do not merge.

---

## Stage 1 — UMAMOE

**Responsibility:** Acquire raw external data, transport it, validate it, and store it safely.  
**Produces for Stage 2:** Trusted Pipeline Record

### Internal Flow

```text
uma.moe API
    │
    ▼  [Raw API response]
  Miner
    │  Raw Data Envelope
    ▼
  Courier
    │  Transport Envelope
    ▼
  Inspector
    │  Validated Envelope
    ▼
  Vault
    │  Trusted Pipeline Record
    ▼
  Refinery (Stage 2)
```

### Departments

#### Miner
- **Does:** HTTP requests to uma.moe endpoints; rate-limit queue; exponential backoff retry; raw response collection.
- **Never does:** Validation, persistence, rendering, notifications.
- **Endpoint registry:** `umamoe/MINER_ENDPOINTS.md`

#### Courier
- **Does:** Transports Miner output to Inspector unchanged; basic transportability checks only; envelope routing.
- **Never does:** Business rules, validation, storage, modification of data content.

#### Inspector
- **Does:** Validates structure, completeness, types, and ranges; accepts or rejects; classifies errors; does not modify data.
- **Never does:** Storage, rendering, notifications, database writes.
- **Validation rules:** `umamoe/Inspector/VALIDATION_RULES.md`

#### Vault
- **Does:** Stores accepted validated envelopes; provides retrieval to Refinery only; manages snapshots and version history.
- **Never does:** Validation, rendering, notifications, API requests.

### Data Envelopes

**Miner → Courier (Raw Data Envelope — success)**
```json
{
  "success": true,
  "data": "<raw API response>",
  "metadata": {
    "endpoint": "",
    "source": "",
    "statusCode": 200,
    "timestamp": "<ISO>",
    "attempts": 1
  }
}
```

**Miner → Courier (Raw Data Envelope — failure)**
```json
{
  "success": false,
  "error": "API_NOT_FOUND | NETWORK_ERROR | ...",
  "message": "",
  "retriable": true,
  "context": { "endpoint": "", "statusCode": 0 }
}
```

**Inspector → Vault (Validated Envelope)**
```json
{
  "trustedData": { "id": "", "...normalized fields...": "" },
  "metadata": { "source": "", "endpoint": "", "inspectedAt": "<ISO>" }
}
```

**Vault → Refinery (Trusted Pipeline Record)**
```json
{ "success": true, "storedAt": "<ISO>" }
```
On failure: `{ "success": false, "code": "", "message": "" }`

### Stage 1 Rules
- Miner is the only department that communicates with external APIs.
- Inspector is the only department that rejects data. Vault only stores what Inspector approved.
- Data never moves backward from Vault to Inspector or Miner.
- Full contract reference: `INFRASTRUCTURE/Contracts/contract.md`, `umamoe/DATA_FORMAT.md`

---

## Stage 2 — REFINERY

**Responsibility:** Transform trusted raw records into canonical compiled products.  
**Receives from Stage 1:** Trusted Pipeline Record (from Vault)  
**Produces for Stages 3 & 5:** Compiled Product (from Depot)

### Internal Flow

```text
Vault (Stage 1)
    │  Trusted Pipeline Record
    ▼
  Refiner
    │  Refined Result
    ▼
  Compiler
    │  Compiled Product
    ▼
  Depot
    │  Stored Product
    ├──────────────────────────▶ Workshop (Stage 3)
    └──────────────────────────▶ Broadcast/Broker (Stage 5)
```

### Departments

#### Refiner
- **Does:** Deterministic business logic — fan gain deltas, velocity, trend calculations, milestone tier eligibility, derived values, normalization.
- **Never does:** API requests, validation of raw data, product assembly, storage.

#### Compiler
- **Does:** Combines one or more Refined Results into a single canonical Compiled Product following documented conflict-resolution rules; records product provenance.
- **Never does:** Domain calculations, API requests, storage.

#### Depot
- **Does:** Persists Compiled Products with explicit `id` and `version`; serves Workshop and Broadcast on request; manages product retention.
- **Never does:** Refinement, calculations, rendering, notifications.

### Stage 2 Rules
- Refinery is the only stage that transforms data. Neither Workshop nor Broadcast applies business logic.
- Depot serves two consumers: Workshop (pull on demand) and Broadcast/Broker (pull on trigger). Both consumers are equal. Neither has priority over the other.
- All derived values (gains, velocities, tier flags) must be computed in Refiner and stored in Depot — never re-derived inside Workshop or Broadcast.

---

## Stage 3 — WORKSHOP (Command Path)

**Responsibility:** Transform Compiled Products into validated, presentation-ready deliverables for user commands.  
**Receives from Stage 2:** Compiled Product (from Depot)  
**Produces for Stage 4:** Approved deliverable in Terminal

### Internal Flow

```text
Depot (Stage 2)
    │  Compiled Product
    ▼
  Draftsman
    │  Blueprint Spec
    ▼
  Fabricator
    │  Constructed Deliverable
    ▼
  Validator
    │  Approved Deliverable
    ▼
  Terminal
    │  Staged Deliverable (awaiting pickup)
    ▼
  Distribution (Stage 4)
```

### Departments

#### Draftsman
- **Does:** Manages the blueprint specification library; defines required structure, layout, components, styling, and presentation rules for each deliverable type.
- **Never does:** Construction, validation, storage, delivery.
- **Blueprints:** `Workshop/Draftsman/Blueprint/` — 15 specs: `leaderboard`, `milestone`, `warning`, `greeting`, `help`, `total_fan`, `circle_master`, `joindate`, `store`, `timeline`, `fan_gain`, `profile`, `circle`, `link`, `set_fans`

#### Fabricator
- **Does:** Constructs Discord embeds and image cards by reading a blueprint from Draftsman and compiled data from Depot. Renders PNG buffers, embed objects, and attachment payloads.
- **Never does:** Blueprint definition, output validation, delivery to Discord.

#### Validator
- **Does:** Checks completed deliverables against their blueprint spec; verifies structure, completeness, consistency, and visual quality; approves or rejects before Terminal placement.
- **Never does:** Construction, delivery, data modification.

#### Terminal
- **Does:** Immutable staging area; holds approved deliverables until Distribution retrieves them; represents the official handoff point from Workshop to Distribution.
- **Never does:** Modification of deliverables, routing, delivery.

### Stage 3 Rules
- Workshop never modifies source data. It renders from what Depot provides; it does not re-calculate.
- Workshop never delivers to Discord. Its responsibility ends at Terminal.
- Broadcast may call `Workshop/Fabricator` directly to render image cards (e.g., milestone card rendering inside Announcer). This is the only cross-path call permitted between Workshop and Broadcast, and it is one-directional: Broadcast → Fabricator only.
- Every deliverable type must have a Draftsman blueprint before Fabricator builds it.

---

## Stage 4 — DISTRIBUTION (Command Path)

**Responsibility:** Receive approved deliverables from Workshop/Terminal, route them to the correct Discord destination in response to user commands.  
**Receives from Stage 3:** Approved Deliverable (from Terminal)  
**Produces:** Application Response delivered to Discord

**Status: PENDING FORMALIZATION (v0.1.0)**

### Planned Internal Flow

```text
Terminal (Stage 3)
    │  Approved Deliverable
    ▼
  Retriever
    │  Fetched Deliverable
    ▼
  Dispatcher
    │  Routed Response
    ▼
  Discord
```

### Planned Departments

#### Retriever
- **Does:** Pulls approved deliverables from Workshop/Terminal on command invocation.

#### Dispatcher
- **Does:** Routes the fetched deliverable to the correct Discord destination (channel reply, ephemeral reply, DM).

### Stage 4 Rules
- Distribution only delivers what Workshop has approved. It does not construct deliverables.
- Distribution only responds to user-initiated commands or Discord events. Automatic notifications go through Broadcast, not Distribution.
- Distribution does not read directly from Depot. It reads from Terminal (Workshop output) or asks Workshop to render on demand.

---

## Stage 5 — BROADCAST (Notification Path)

**Responsibility:** Detect notification conditions, approve notifications, store delivery state, and deliver to Discord — automatically, on schedule, with restart-safety.  
**Receives from Stage 2:** Compiled Product (from Depot, via Broker)  
**Produces:** Delivered notifications to Discord (channel posts, member DMs, leader DMs)

### Internal Flow

```text
Depot (Stage 2)
    │  Compiled Product  ← Broker fetches on cron trigger or threshold event
    ▼
  Broker
    │  Notification Envelope (raw data + trigger context)
    ▼
  Archive-Inspector
    │  if rejected → drop cleanly, nothing written
    │  if approved → write full notification record to Archive
    ▼
  Archive  (pure storage)
    │  notificationKey
    ▼
  Archive-Transporter
    │  Full Notification Record (incl. imageParams)
    ▼
  Announcer
    │  render card (via Workshop/Fabricator) → post channel → send DMs → update Archive flags
    ▼
  Discord
```

**On restart (incomplete delivery recovery):**
```text
Broker reads Archive.getIncomplete()
    │  notificationKey (records with any delivery flag = 0)
    ▼
Archive-Transporter  (bypasses Archive-Inspector — already approved)
    │  Full Notification Record
    ▼
Announcer
    │  checks each flag: if 1 → skip, if 0 → execute
    ▼
  Discord  (no duplicate channel post; no missed DMs)
```

### Departments

#### Broker
- **Does:** Cron-triggered or threshold-triggered entry point; fetches compiled data from Refinery/Depot; hands raw data to Archive-Inspector; on restart, reads Archive for incomplete records and routes to Archive-Transporter.
- **Never does:** Eligibility checking, dedup checking, archive writes, Discord delivery.

#### Archive-Inspector
- **Does:** Runs every eligibility check (threshold met? grace period over? tally open?); dedup check (Archive record already exists?); recipient resolution (which channels, which member DMs, whether leader DM); variant selection (message content + image parameters). If all pass → writes full notification record to Archive. If any fail → drops cleanly.
- **Is the only department that creates new Archive records.**
- **Never does:** Discord delivery, data retrieval, archive reads after writing.

#### Archive
- **Does:** Pure storage. Holds notification records and delivery state flags. Exposes a clean interface per authorized caller.
- **Never does:** Pipeline logic, eligibility decisions, delivery.
- **Authorized operations by caller:**

| Operation | Authorized Caller |
|---|---|
| `INSERT` new notification record | Archive-Inspector only |
| `SELECT` full record by key | Archive-Transporter |
| `UPDATE` delivery flags (`channel_sent`, `dm_member_sent`, `dm_leader_sent`) | Announcer only |
| `SELECT` incomplete records (any flag = 0) | Broker only |
| `INSERT` delivery history row | Announcer only |

#### Archive-Transporter
- **Does:** Receives a `notificationKey` from Archive-Inspector (new delivery) or Broker (restart recovery); reads full notification record from Archive including all `imageParams`; validates it; passes complete record to Announcer.
- **Never does:** Creating Archive records, eligibility decisions, Discord delivery.

#### Announcer
- **Does:** Receives a fully-loaded notification record from Archive-Transporter; executes delivery plan step by step — for each step: check flag (if 1, skip), execute (render via Fabricator, post channel, send DMs), on success update Archive flag + append history row, on failure log and leave flag at 0 (Broker surfaces it again on next run).
- **Never does:** Re-evaluating eligibility, reading initial record from Archive, creating Archive records.

### Stage 5 Rules
- Broadcast never fires from a user command. User commands go through Distribution.
- Archive-Inspector is the sole gatekeeper and sole creator of Archive records. No other department writes notification records.
- Announcer always receives data via Archive-Transporter. It never reads its initial delivery record directly from Archive.
- Every notification type requires an Archive schema entry, a Fabricator render template, an Archive-Inspector eligibility rule, and a Broker data-fetch registration.
- Restart-safety is not optional. Any new notification type must implement flag-based idempotent delivery.

---

## Cross-Cutting: INFRASTRUCTURE

Infrastructure is not a pipeline stage. It is the support layer that all stages draw from.

```text
INFRASTRUCTURE/
├── Adapters/     — Interface adapters between departments and external systems
├── Contracts/    — Canonical data envelope definitions for all stage handoffs
├── Errors/       — Error taxonomy, error codes, and shared error handling
├── Policy/       — Cross-cutting rules (rate limits, retry policies, retention)
├── Telemetry/    — Structured logging interface
└── core/         — Shared utilities: task registry, health, error handling, logging
```

**Rules:**
- All departments log through a shared logging interface. Direct console output is prohibited in pipeline departments.
- Error handling uses shared utilities — `safeRun()` and `withRetry()` patterns for recoverable failures with exponential backoff.
- Task health tracking records last run, success/failure, and consecutive failure counts.
- Infrastructure never owns pipeline business logic. It only provides utilities.

---

## Cross-Cutting: OPERATION

Operation is an independent health supervisor. It runs alongside the pipeline but does not participate in any pipeline stage.

```text
Operation/
├── Manager/      — Coordinates health checks and system state
├── Investigator/ — Detects pipeline health violations and anomalies
└── Logger/       — Structured log aggregation for health reporting
```

Operation monitors but never controls. It cannot redirect pipeline flow or change pipeline ownership. Findings are escalated to the Repository Owner when architectural changes are required.

---

## Ownership Matrix

| Responsibility | Owner | Stage |
|---|---|---|
| API extraction | Miner | 1 |
| Raw data transport | Courier | 1 |
| Data validation | Inspector | 1 |
| Trusted storage | Vault | 1 |
| Data refinement & derived values | Refiner | 2 |
| Product assembly | Compiler | 2 |
| Product persistence & serving | Depot | 2 |
| Blueprint specifications | Draftsman | 3 |
| Deliverable construction & rendering | Fabricator | 3 |
| Deliverable validation | Validator | 3 |
| Deliverable staging | Terminal | 3 |
| Command routing | Distribution (Retriever + Dispatcher) | 4 |
| Broadcast triggering & data fetch | Broker | 5 |
| Notification eligibility & approval | Archive-Inspector | 5 |
| Notification state & delivery history | Archive | 5 |
| Notification fetch-and-handoff | Archive-Transporter | 5 |
| Discord delivery (notifications) | Announcer | 5 |

---

## Forbidden Patterns

These are unconditional violations. No feature request, deadline, or convenience justifies them.

| Pattern | Why Forbidden |
|---|---|
| Miner calling Vault directly (skipping Courier + Inspector) | Bypass of validation; untrusted data enters storage |
| Workshop re-calculating fan deltas or gains | Business logic belongs to Refiner; Workshop renders only |
| Broadcast sending to Discord without Archive record | Breaks restart-safety and dedup; notifications may duplicate |
| Distribution firing automatic notifications | Automatic notifications are exclusively owned by Broadcast |
| Any department reading from Depot except Workshop and Broadcast/Broker | Depot serves two consumers only |
| Archive-Inspector being bypassed for new notification records | Eligibility and dedup would be skipped |
| Announcer creating Archive records | Only Archive-Inspector creates records |
| Any stage calling backward (e.g., Workshop → Inspector) | Forward-only is a constitutional rule |
| Two departments owning the same responsibility | One owner per responsibility; registry governs |

---

## Adding a New Feature — Which Stage Owns It?

1. **New data from uma.moe** → Miner (extraction), Inspector (validation), Vault (storage)
2. **New derived metric or fan calculation** → Refiner
3. **New compiled data product** → Compiler + Depot
4. **New image card or embed design** → Draftsman (blueprint) + Fabricator (render)
5. **New slash command** → Distribution
6. **New automatic notification** → Broker (trigger) + Archive-Inspector (rule) + Fabricator (render template) + Announcer (delivery handler)
7. **New error type** → INFRASTRUCTURE/Errors
8. **New shared utility** → INFRASTRUCTURE/core (if stateless and cross-cutting) or the owning stage's utilities

If no stage clearly owns the responsibility, **stop and file an Architecture Decision** before implementing. Do not guess and do not duplicate.

---

## Document Maintenance

This document must be updated whenever:
- A new department is added to any stage
- A data envelope contract changes between any two departments
- A new delivery path is added (requires architectural approval first)
- A stage boundary or handoff point moves
- Distribution is formally restructured

All updates to this document must be accompanied by an entry in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`.

---

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`  
**Maintained by:** Repository Owner  
**Version:** 1.0.0
