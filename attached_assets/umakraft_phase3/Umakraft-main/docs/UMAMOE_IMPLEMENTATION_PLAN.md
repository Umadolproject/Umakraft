# UmaMoe Pipeline — Architecture Overview

## What This Is

This document describes the **UmaMoe data pipeline** — a structured, single-responsibility data layer with four clearly defined departments:

```text
uma.moe API
   │
   ▼
Miner      → fetches raw data
   │
   ▼
Courier    → transports data unchanged
   │
   ▼
Inspector  → validates structure, types, completeness
   │
   ▼
Vault      → stores trusted data, serves downstream consumers
```

Full architecture documentation lives in `umamoe/`. Start with `umamoe/README.md`.

---

## Guiding Principles

- **Single responsibility** — each department owns exactly one concern.
- **Forward-only data flow** — data moves from Miner → Courier → Inspector → Vault, never backward.
- **No validation skipping** — Vault only stores what Inspector has approved.
- **No external calls downstream** — only Miner communicates with the uma.moe API.

---

## Department Responsibilities

| Department | Responsibility | May Never |
|---|---|---|
| Miner | HTTP requests to approved uma.moe endpoints; rate-limiting; exponential backoff retry | Validate, persist, render, notify |
| Courier | Transport Miner output to Inspector unchanged; basic transportability checks only | Apply business rules, validate content, modify data |
| Inspector | Validate structure, completeness, types, ranges; accept or reject; classify errors | Store, render, notify, modify data |
| Vault | Store accepted validated envelopes; serve retrieval to Refinery only; manage snapshots and version history | Validate, render, notify, make API requests |

---

## Documentation Map

```
umamoe/
├── README.md                    ← Entry point for this directory
├── Overview.md                  ← Architecture and philosophy
├── DATA_FORMAT.md               ← Trainer object schema
├── ERROR_HANDLING.md            ← Error types, format, retry rules
├── MINER_ENDPOINTS.md           ← Approved uma.moe endpoints
├── INTEGRATION_EXAMPLE.md       ← End-to-end scenarios
├── Miner/
│   └── Miner.md                 ← Miner department specification
├── Courier/
│   └── Courier.md               ← Courier department specification
├── Inspector/
│   ├── Inspector.md             ← Inspector department specification
│   └── VALIDATION_RULES.md      ← All 5 validation categories
└── Vault/
    └── Vault.md                 ← Vault department specification
```

---

## Validation Categories

Inspector applies five validation categories (see `umamoe/Inspector/VALIDATION_RULES.md` for full detail):

1. **Existence** — data is not null/undefined
2. **Structure** — data is a plain object with required fields present as keys
3. **Completeness** — required field values are not empty
4. **Type integrity** — `fans` is number, `rank` is number, `id`/`name` are string
5. **Range integrity** — `fans ≥ 0`, `rank` 1–100

---

## Approved Endpoints

All external API calls are restricted to the endpoints listed in `umamoe/MINER_ENDPOINTS.md`. No department other than Miner may call the uma.moe API.

---

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`  
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`  
**Version:** 1.0.0  
**Last Updated:** 2026-07-21
