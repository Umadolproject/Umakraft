# UmaKraft

Architecture and documentation repository for the **UmaKraft** Uma Musume Circle Bot — a Discord bot that tracks daily, weekly, and monthly fan gains for circle `974470619` on [uma.moe](https://uma.moe), posts leaderboards and milestones, and manages member data automatically.

> This repository contains **documentation only** (`.md` files). All architecture specs, department contracts, pipeline rules, and operational standards live here.

---

## Main Pipeline

Information flows forward through five stages. No stage may bypass another.

```
Umamoe
   │  Fetches and validates raw data from uma.moe
   ▼
Refinery
   │  Refines, compiles, and stores canonical data products
   ▼
Workshop
   │  Manufactures user-facing deliverables (cards, embeds)
   ▼
Distribution
   │  Routes and delivers products to their destinations
   ▼
Broadcast
      Pushes automatic notifications to Discord (cron / threshold)
```

---

## Pipeline Directories

### `umamoe/`
Data ingestion pipeline. Communicates with the uma.moe API and processes all incoming data.

| Department | Responsibility |
|---|---|
| `Miner` | Extracts raw data from the uma.moe API |
| `Courier` | Transports data between departments without modification |
| `Inspector` | Validates and verifies data integrity |
| `Vault` | Persists validated data for downstream use |

→ See [`umamoe/Overview.md`](umamoe/Overview.md)

---

### `Refinery/`
Transforms trusted Vault data into finished canonical products.

| Department | Responsibility |
|---|---|
| `Refiner` | Runs deterministic business logic (gains, trends, flags) |
| `Compiler` | Merges refined results into compiled products |
| `Depot` | Persists compiled products and serves them to consumers |

→ See [`Refinery/Overview.md`](Refinery/Overview.md)

---

### `Workshop/`
Manufactures user-facing deliverables from Depot products.

| Department | Responsibility |
|---|---|
| `Draftsman` | Defines product specifications and blueprints |
| `Fabricator` | Constructs deliverables following the spec |
| `Validator` | Inspects deliverables for compliance before release |
| `Terminal` | Holds approved deliverables for handoff to Distribution |

→ See [`Workshop/Workshop.md`](Workshop/Workshop.md)

---

### `distribution/`
Routes approved deliverables to their intended destinations.

- `dist/` — distributable bundle of the ingestion pipeline and related artifacts

→ See [`distribution/README.md`](distribution/README.md)

---

### `Broadcast/`
Event-notification pipeline. Fires automatically on cron schedules or data thresholds — never from slash commands.

| Department | Responsibility |
|---|---|
| `Broker` | Entry point — fetches data from Depot and triggers the pipeline |
| `archive-inspector` | Sole decision-maker — validates eligibility, deduplicates, resolves recipients |
| `Archive` | Pure storage — holds notification records and delivery state |
| `archive_transporter` | Fetches full notification records and hands them to Announcer |
| `Announcer` | Delivery engine — renders cards and posts to Discord channel + DMs |

→ See [`Broadcast/Overview.md`](Broadcast/Overview.md)

---

## Operation

Health supervisor that runs across the entire pipeline. Not a pipeline stage — it observes all stages and escalates failures to Discord via Broadcast.

| Department | Responsibility |
|---|---|
| `Investigator` | Observes task registry, sync state, and runtime metrics |
| `Logger` | Formats investigation records into structured log entries |
| `Manager` | Evaluates logs and emits a health decision (Healthy / Warning / Critical / Failed) |

→ See [`Operation/README.md`](Operation/README.md)

---

## Governance Documents

| File | Purpose |
|---|---|
| [`ARCHITECTURE_AUTHORITY.md`](ARCHITECTURE_AUTHORITY.md) | Constitutional authority — supreme repository law |
| [`ARCHITECTURE_DECISIONS.md`](ARCHITECTURE_DECISIONS.md) | Log of all approved architectural decisions |
| [`PIPELINE_REGISTRY.md`](PIPELINE_REGISTRY.md) | Official registry of every pipeline department |
| [`PIPELINE_OPERATIONS.md`](PIPELINE_OPERATIONS.md) | Daily operational standards and procedures |
| [`PIPELINE_EVOLUTION.md`](PIPELINE_EVOLUTION.md) | Approved evolution path and roadmap |

---

## Supporting Directories

| Directory | Purpose |
|---|---|
| `Adapters/` | Adapter interface contracts |
| `Contracts/` | Cross-department data contracts |
| `Delivery/` | Delivery interface specs |
| `Errors/` | Error classification and handling standards |
| `Interaction/` | Discord slash command and interaction specs |
| `Policy/` | Repository and operational policies |
| `Retriever/` | Data retrieval interface specs |
| `Telemetry/` | Observability and metrics standards |
| `docs/` | Command references, knowledge base, implementation plans |

---

## Temporary

The `Temporary/` directory holds files parked for review — not part of the active architecture.

| Contents |
|---|
| `Member-Archive/` — active and inactive member records |
| `docs-notes/` — development notes and environment references |
| `replitdocs/` — Replit-specific project notes |
| `roles.md`, `Image-report-standard.md` — miscellaneous root files |
