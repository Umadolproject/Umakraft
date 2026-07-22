# Roadmap

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This document is the long-term feature roadmap for the Umakraft AI Knowledge Service. It reflects the phased implementation plan in `IMPLEMENTATION_PLAN.md` and extends it with post-launch features and future vision.

---

## Phase 1 — Foundation

**Goal:** Core infrastructure, provider abstraction, configuration.

| Feature | Status |
|---|---|
| API Provider (OpenAI, Gemini, Claude, OpenRouter, Ollama) | Planned |
| Configuration and environment validation | Planned |
| Security layer (read-only enforcement) | Planned |
| Cache layer (embedding + response) | Planned |
| Registration in Pipeline Registry | Planned |

---

## Phase 2 — Repository Intelligence

**Goal:** Full read understanding of the Umakraft repository.

| Feature | Status |
|---|---|
| Repository Indexer (file scanner, classifier, chunk builder) | Planned |
| Vector Database (embedding storage, similarity search) | Planned |
| RAG Engine (query → retrieve → rank) | Planned |
| Context Builder (chunk assembly, deduplication, token budget) | Planned |
| Source citation in every repository answer | Planned |

---

## Phase 3 — Knowledge Engine

**Goal:** Umamusume domain knowledge and glossary.

| Feature | Status |
|---|---|
| Umamusume glossary (MANT, fan gain, circle rank, etc.) | Planned |
| Mechanic catalog (fan deficit, milestone, trainer level) | Planned |
| `/ai glossary <term>` command | Planned |
| Umamusume scope classification in Topic Filter | Planned |

---

## Phase 4 — Content Generation

**Goal:** Community message generation.

| Feature | Status |
|---|---|
| Content Generator pipeline | Planned |
| All 7 message type templates | Planned |
| 100–150 word enforcement | Planned |
| Re-generation on validation failure | Planned |
| `/ai message <type>` command | Planned |

---

## Phase 5 — Command Surface

**Goal:** Discord command integration.

| Feature | Status |
|---|---|
| `/ask` command | Planned |
| `/ai explain` command | Planned |
| `/ai search` command | Planned |
| `/ai docs` command | Planned |
| `/ai glossary` command | Planned |
| `/ai message` command | Planned |
| Topic Filter (repository / Umamusume / message / off-topic) | Planned |
| Response Validator (all 6 checks) | Planned |

---

## Phase 6 — Observability

**Goal:** Full health supervision and monitoring.

| Feature | Status |
|---|---|
| Operation supervisor integration | Planned |
| Structured audit logging via `core/log.js` | Planned |
| Cache hit rate reporting | Planned |
| Response latency tracking | Planned |
| Indexing health report | Planned |

---

## Phase 7 — Advanced Features

**Goal:** Power-user and quality-of-life improvements.

| Feature | Status |
|---|---|
| Conversation memory (short-term, single session) | Planned |
| Citation mode (source file list per answer) | Planned |
| Confidence score (retrieval quality indicator) | Planned |
| Multi-language response support | Planned |
| Blueprint validator (governance compliance check) | Planned |
| Documentation quality checker | Planned |

---

## Post-Launch Ideas

These features are not yet formally planned but represent the long-term vision for the AI Knowledge Service.

### Analytics

- Query frequency dashboard — most asked questions per week
- Cache hit rate trends
- Provider cost tracking per command type
- Off-topic rejection rate monitoring

### Plugin Ecosystem

A plugin registry allowing community-contributed knowledge modules:

| Plugin | Description |
|---|---|
| RepositoryStats | Daily snapshot of repository coverage and documentation health |
| BlueprintValidator | Validate a proposed blueprint against workshop governance rules |
| DocumentationQA | Check a new document for completeness against the standard |
| HallOfFame | Generate milestone recap messages for top monthly trainers |
| Localization | Multi-language glossary and message support |

### Incremental Intelligence

- Git diff awareness — automatically re-index when files change without a full scan
- Broken link detection — identify references to deleted or moved files
- Duplicate documentation detection — flag near-identical content across departments
- Repository health score — % of files fully documented per department

### Multi-Repository Support

Future support for querying multiple related repositories simultaneously, with cross-repository source citation.

---

## Constraints

All future features must comply with the read-only principle:

> The AI may read. The AI may never write.

Any feature proposal that requires write access must be submitted as a formal Architecture Decision Record in `GOVERNANCE/ARCHITECTURE_DECISIONS.md` and approved by the Architecture Authority.

---

## Related Documents

- `AI/IMPLEMENTATION_PLAN.md` — detailed phase-by-phase task breakdown
- `AI/ARCHITECTURE.md` — full system architecture
- `GOVERNANCE/ARCHITECTURE_DECISIONS.md` — ADR ledger for feature approvals
- `GOVERNANCE/PIPELINE_EVOLUTION.md` — how the architecture evolves

---

## Version History

- `v1.0.0` — Initial Roadmap; seven implementation phases; post-launch analytics, plugin ecosystem, and multi-repo vision; read-only constraint reiterated
