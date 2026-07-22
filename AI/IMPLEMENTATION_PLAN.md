# AI Implementation Plan

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This document defines the phase-by-phase implementation plan for the Umakraft AI Knowledge Service.

Each phase builds on the previous. No phase may be skipped. Implementation must follow the read-only constraint at every step — no AI component may ever write to the repository, database, or Discord.

---

## Objectives

- Answer repository questions accurately with source citations
- Answer Umamusume domain questions
- Reject all off-topic requests at the Topic Filter
- Generate 100–150 word community messages on request
- Never modify the repository under any circumstances
- Remain operational and supervised by the Operation health supervisor

---

## Phase Overview

| Phase | Name | Deliverable |
|---|---|---|
| 1 | Foundation | Core infrastructure, provider abstraction, config |
| 2 | Repository Intelligence | Indexer, vector database, RAG engine |
| 3 | Knowledge Engine | Umamusume domain knowledge, glossary |
| 4 | Content Generation | Message templates, content generator |
| 5 | Command Surface | Discord commands, topic filter, response validator |
| 6 | Observability | Caching, logging, health integration |
| 7 | Advanced Features | Conversation memory, citation mode, confidence scores |

---

## Phase 1 — Foundation

**Goal:** Establish the core infrastructure before any AI logic is built.

### Tasks

- [ ] Implement `API_PROVIDER` — abstract layer supporting OpenAI, Gemini, Claude, OpenRouter, Ollama
- [ ] Implement `CONFIGURATION` — environment variables, model selection, feature flags
- [ ] Implement `SECURITY` — read-only enforcement wrapper, permission matrix
- [ ] Implement `CACHE` — in-memory response cache and embedding cache
- [ ] Register AI Knowledge Service in `GOVERNANCE/PIPELINE_REGISTRY.md`
- [ ] Register AI department in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`

### Acceptance Criteria

- [ ] API provider can call OpenAI and return a response
- [ ] Provider falls back to secondary model on failure
- [ ] All secrets loaded from environment — never hardcoded
- [ ] Read-only enforcement blocks any write attempt

---

## Phase 2 — Repository Intelligence

**Goal:** Give the AI full read understanding of the Umakraft repository.

### Tasks

- [ ] Implement `REPOSITORY_INDEXER` — file scanner, document classifier, chunk builder
- [ ] Implement `VECTOR_DATABASE` — embedding storage, similarity search
- [ ] Implement `RAG_ENGINE` — retrieval pipeline: query → embed → search → rank → return
- [ ] Implement `REPOSITORY_ENGINE` — orchestrates indexer, vector database, and RAG
- [ ] Implement `CONTEXT_BUILDER` — assembles retrieved chunks into a coherent prompt context
- [ ] Run initial full index of the repository

### Acceptance Criteria

- [ ] All Markdown, JS, and governance files are indexed
- [ ] Semantic search returns relevant results for a repository question
- [ ] Context window stays within provider token limits
- [ ] Source citations (file path + section heading) are attached to every answer

---

## Phase 3 — Knowledge Engine

**Goal:** Equip the AI with Umamusume domain knowledge.

### Tasks

- [ ] Implement `KNOWLEDGE_ENGINE` — Umamusume facts, mechanics, terminology
- [ ] Build glossary: MANT, fan gain, circle rank, trainer level, skill cards
- [ ] Integrate knowledge engine with context builder
- [ ] Add Umamusume classification branch to Topic Filter

### Acceptance Criteria

- [ ] AI correctly explains MANT, fan gain, and circle mechanics
- [ ] AI correctly identifies and rejects off-topic Umamusume sub-questions (e.g. horse racing trivia)
- [ ] Glossary lookup `/ai glossary <term>` returns accurate definitions

---

## Phase 4 — Content Generation

**Goal:** Enable community message generation.

### Tasks

- [ ] Implement `CONTENT_GENERATOR` — message generation pipeline
- [ ] Implement `MESSAGE_SYSTEM` — template registry and output formatting
- [ ] Implement `PROMPT_SYSTEM` — prompt builder with variable injection
- [ ] Create prompt templates: `prompts/Greeting.md`, `prompts/Milestone.md`, `prompts/Achievement.md`, `prompts/Leaderboard.md`, `prompts/Warning.md`, `prompts/Reminder.md`, `prompts/Documentation.md`
- [ ] Enforce 100–150 word output limit via `RESPONSE_VALIDATOR`

### Acceptance Criteria

- [ ] `/ai message greeting` generates a 100–150 word greeting
- [ ] Generated messages do not contain prohibited content
- [ ] Message output passes the response validator

---

## Phase 5 — Command Surface

**Goal:** Expose the AI Knowledge Service to Discord users via slash commands.

### Tasks

- [ ] Implement `TOPIC_FILTER` — repository scope, Umamusume scope, message scope, off-topic rejection
- [ ] Implement `RESPONSE_VALIDATOR` — scope check, grammar check, length check, hallucination check
- [ ] Register slash commands: `/ask`, `/ai explain`, `/ai search`, `/ai docs`, `/ai glossary`, `/ai message`
- [ ] Integrate with `Distribution/Discord` event pipeline

### Acceptance Criteria

- [ ] `/ask "explain fan gain"` returns an accurate repository-sourced answer
- [ ] `/ask "who is the president"` returns a polite off-topic rejection
- [ ] `/ai search "Miner"` returns relevant file references
- [ ] Response validator blocks any answer that references out-of-scope content

---

## Phase 6 — Observability

**Goal:** Make the AI subsystem fully observable and supervised.

### Tasks

- [ ] Integrate with `Operation` health supervisor via `core/taskRegistry.js`
- [ ] Add structured logging via `core/log.js`
- [ ] Implement embedding cache warming on startup
- [ ] Add response latency tracking
- [ ] Add cache hit rate reporting

### Acceptance Criteria

- [ ] Operation supervisor correctly reports AI health state
- [ ] Cache hit rate is visible in logs
- [ ] Average response latency is logged per request

---

## Phase 7 — Advanced Features

**Goal:** Add power-user and quality-of-life features.

### Tasks

- [ ] Conversation memory — short-term context across turns in a single session
- [ ] Citation mode — append source file list to every answer
- [ ] Confidence score — report retrieval confidence per answer
- [ ] Multi-language support — respond in the user's language
- [ ] Blueprint validator — validate a blueprint document against governance rules
- [ ] Documentation quality checker — identify missing sections in documentation

### Acceptance Criteria

- [ ] A follow-up question correctly uses context from the previous turn
- [ ] Citation mode lists source files with section headings
- [ ] Confidence score appears at the end of each answer

---

## Security Constraint (All Phases)

Every phase must respect the read-only constraint:

```text
READ: YES — all repository files, source code, documentation, governance
WRITE: NO — files, databases, Discord settings, commits, secrets
```

No exception may be made to this constraint without a formal Architecture Decision Record in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`.

---

## Related Documents

- `AI/ARCHITECTURE.md` — full system design
- `AI/SECURITY.md` — permission model
- `AI/ROADMAP.md` — long-term feature roadmap
- `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` — supreme law
- `GOVERNANCE/PIPELINE_REGISTRY.md` — department registry

---

## Version History

- `v1.0.0` — Initial implementation plan; seven phases defined; full task breakdown and acceptance criteria per phase
