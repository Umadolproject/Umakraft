# Umamoe

**STAGE 1: Extract, Transport, Validate & Store**

## Purpose

Acquire raw data from external sources, validate integrity, and store in trusted persistence layer.

## Departments

| Department | Purpose |
|------------|----------|
| **Miner** | Extract raw data from uma.moe API |
| **Courier** | Transport data without modification |
| **Inspector** | Validate data structure and integrity |
| **Vault** | Trusted persistence layer |

## Pipeline Flow

```
API → Miner → Courier → Inspector → Vault → Refinery
```

## Status

**IMPLEMENTED** (v1.0.0)

Legacy module absorption pending (umaClient, umaQueue, umaCache, uma.js)

## Specifications

- `DATA_FORMAT.md` — Trusted data structure
- `ERROR_HANDLING.md` — Error classification
- `INTEGRATION_EXAMPLE.md` — End-to-end examples
- `MINER_ENDPOINTS.md` — Approved API endpoints

## See Also

- `GOVERNANCE/PIPELINE_REGISTRY.md` — Umamoe stage specification
- `GOVERNANCE/PIPELINE_EVOLUTION.md` — Assimilation backlog
