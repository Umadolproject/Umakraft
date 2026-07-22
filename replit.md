# UmaKraft Pipeline Architecture

A constitutional data pipeline for acquiring, validating, rendering, and delivering Uma Musume trainer data via Discord bot.

## About This Repository

UmaKraft is a five-stage data pipeline governed by constitutional architecture documents. Every department has exclusive ownership of its responsibility. The pipeline flows forward only.

```
Umamoe (Stage 1) → Refinery (Stage 2) → Workshop (Stage 3) → Distribution (Stage 4) → Broadcast (Stage 5)
```

## Stack

- **Runtime:** Node.js 24 (ESM — `"type": "module"`)
- **Language:** JavaScript
- **External API:** uma.moe REST API
- **Discord:** Discord.js (to be added in Distribution build phase)

## Running the Project

### Run Umamoe unit tests (no live API required)

```bash
node umamoe/test/pipeline.test.js
```

### Run Refinery unit tests

```bash
node Refinery/test/pipeline.test.js
```

### Run Umamoe → Refinery integration tests

```bash
node umamoe/test/integration.test.js
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `UMA_MOE_API_BASE_URL` | `https://uma.moe/api` | Base URL for uma.moe API |
| `API_TIMEOUT_MS` | `30000` | Request timeout in milliseconds |
| `API_MAX_RETRIES` | `3` | Maximum retry attempts |
| `API_RETRY_BACKOFF_MS` | `1000` | Initial backoff delay |

## Architecture

### Governance (read before contributing)

| Document | Purpose |
|----------|---------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Supreme law — read first |
| `GOVERNANCE/PIPELINE_REGISTRY.md` | Official department registry |
| `GOVERNANCE/PIPELINE_OPERATIONS.md` | Operational standards |
| `GOVERNANCE/PIPELINE_EVOLUTION.md` | How architecture evolves |
| `GOVERNANCE/ARCHITECTURE_DECISIONS.md` | ADR ledger |

### Stage 1 — Umamoe (BUILT)

Acquire, transport, validate, and store raw uma.moe data.

| Department | File | Responsibility |
|------------|------|---------------|
| Miner | `umamoe/Miner/miner.js` | HTTP requests to uma.moe API, retry, rate limiting |
| Courier | `umamoe/Courier/courier.js` | Transport Miner envelopes to Inspector |
| Inspector | `umamoe/Inspector/inspector.js` | 5-category data validation |
| Vault | `umamoe/Vault/vault.js` | Trusted data storage (adapter pattern) |

Inspector validation categories: Existence → Structure → Completeness → Type Integrity → Range Integrity

### Stage 2 — Refinery (BUILT)

Transform and compile validated data from the Vault into canonical products.

| Department | File | Responsibility |
|------------|------|---------------|
| Refiner | `Refinery/Refiner/refiner.js` | Business logic — fan gains, trends, delta vs projected |
| Compiler | `Refinery/Compiler/compiler.js` | Deterministic assembly of refinedResults into compiledProducts |
| Depot | `Refinery/Depot/depot.js` | Compiled product storage (adapter pattern) |

Trend tiers: `elite` (rank ≤ 10) → `upward` (≤ 50) → `stable` (≤ 200) → `emerging`

### Stage 3 — Workshop (BUILT)

Draftsman, Fabricator, Validator, and Terminal are all implemented. Fabricator renders image cards via headless Chromium (Puppeteer). Report assimilation from `fantracking/reports/` is in progress.

Render compiled data into Discord embeds and image cards.

### Stage 4 — Distribution (DOCUMENTED)

Coordinate user-facing Discord command flow.

| Department | Responsibility |
|------------|---------------|
| Discord | Raw Discord API surface (events, slash command definitions) |
| Commands | Slash command intake and validation |
| Coordinator | Pipeline orchestration per command |
| Dispatcher | Discord response delivery |

### Stage 5 — Broadcast (BUILT)

Scheduled notifications and announcements to Discord. All five departments are implemented with the in-memory adapter. Production will use the SQLite adapter.

| Department | File | Responsibility |
|------------|------|---------------|
| Broker | `Broadcast/Broker/broker.js` | Entry point; fetches data from Depot; restart recovery |
| Archive-Inspector | `Broadcast/archive-inspector/archiveInspector.js` | Sole approval authority; sole Archive writer |
| Archive | `Broadcast/Archive/archive.js` | Pure storage; adapter pattern (in-memory / SQLite) |
| Archive-Transporter | `Broadcast/archive_transporter/archiveTransporter.js` | Fetch-and-handoff between Archive and Announcer |
| Announcer | `Broadcast/Announcer/announcer.js` | Discord delivery; flag-check-before-act; Operation alerts |

Pipeline wire: `Broadcast/pipeline.js`

Run Broadcast tests:

```bash
node Broadcast/test/pipeline.test.js
```

**Startup sequence** (in `tasks/index.js` / bot entry point):

```js
import * as broadcast from './Broadcast/pipeline.js';

await broadcast.init();
broadcast.registerType('dailyWarning', { buildKey, checkEligibility, resolveRecipients, selectVariant });
broadcast.registerFetch('dailyWarning', async (circleId) => depot.fetch(circleId));
broadcast.setConfiguredCircles(['circle-001']);
await broadcast.recoverIncomplete(null, discordClient);
// Wire into cron schedule:
// cron.schedule('0 23 * * *', () => broadcast.run('dailyWarning', discordClient));
```

**Pending for production:**
- `Broadcast/Archive/adapters/sqliteAdapter.js` — SQLite persistence
- Cron registration in `tasks/index.js`
- Per-type handler registration for each live notification type (milestone, warning, greeting, etc.)

### Operation — Health Supervisor (BUILT)

Independent pipeline supervisor. Runs every 5 minutes, observes all pipeline stages, and escalates to Discord via Broadcast/Announcer on Critical/Failed/Investigation Required decisions.

| Department | File | Responsibility |
|------------|------|---------------|
| Investigator | `Operation/Investigator/investigator.js` | Observes taskRegistry, syncStatus, timelineStatus, memory — produces InvestigationRecords |
| Logger | `Operation/Logger/logger.js` | Formats records into OperationalLogEntry; emits to `core/log.js` |
| Manager | `Operation/Manager/manager.js` | Evaluates entries; emits HealthDecision; routes Critical/Failed/Investigation Required to Announcer |
| Entry Point | `Operation/operation.js` | `runOperationCycle()` — wired into tasks/index.js on `*/5 * * * *` |

**Core infrastructure** (built as part of Operation):

| File | Purpose |
|------|---------|
| `core/log.js` | Structured JSON logger — `log.info/warn/error/debug` |
| `core/taskRegistry.js` | Per-task execution stats (registerTask, recordTaskStart, recordTaskEnd, getAllTaskStats) |
| `core/health.js` | Runtime health snapshot — memory, uptime, task stats |
| `core/errors.js` | `safeRun()` (swallow errors) and `withRetry()` (linear backoff) |
| `tasks/index.js` | `schedule(name, cronExpr, fn)` + `start(client)` — cron interval runner |

**Wiring:** `Distribution/Discord/events/ready.js` calls `schedule('operation', '*/5 * * * *', runOperationCycle)` then `start(client)` on bot ready.

Run Operation tests:
```bash
node Operation/test/pipeline.test.js
```

## User Preferences

- Follow the existing governance document format for all new docs.
- All new departments must be registered in `GOVERNANCE/PIPELINE_REGISTRY.md` and recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`.
- Never merge department responsibilities or bypass pipeline stages.
