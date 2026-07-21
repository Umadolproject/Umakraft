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

### Run Umamoe pipeline tests (no live API required)

```bash
node umamoe/test/pipeline.test.js
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

### Stage 2 — Refinery (PENDING)

Transform and compile validated data.

### Stage 3 — Workshop (PENDING)

Render compiled data into Discord embeds and image cards.

### Stage 4 — Distribution (DOCUMENTED)

Coordinate user-facing Discord command flow.

| Department | Responsibility |
|------------|---------------|
| Discord | Raw Discord API surface (events, slash command definitions) |
| Commands | Slash command intake and validation |
| Coordinator | Pipeline orchestration per command |
| Dispatcher | Discord response delivery |

### Stage 5 — Broadcast (DOCUMENTED)

Scheduled notifications and announcements to Discord.

## User Preferences

- Follow the existing governance document format for all new docs.
- All new departments must be registered in `GOVERNANCE/PIPELINE_REGISTRY.md` and recorded in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`.
- Never merge department responsibilities or bypass pipeline stages.
