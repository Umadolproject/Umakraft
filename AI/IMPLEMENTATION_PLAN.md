# AI Implementation Plan

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.8.0
**Last Updated:** 2026-07-26

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

## Phase 1 — Foundation ✅

**Goal:** Establish the core infrastructure before any AI logic is built.

### Tasks

- [x] Implement `API_PROVIDER` — two-model complexity routing: `simple` → Gemini 1.5 Flash, `complex` → GPT-4o-mini; linear-backoff retry via `core/errors.js` `withRetry()`
- [x] Implement `CONFIGURATION` — environment variables, model selection, feature flags
- [x] Implement `SECURITY` — read-only enforcement wrapper, permission matrix
- [x] Implement `CACHE` — in-memory response cache and embedding cache
- [x] Register AI Knowledge Service in `GOVERNANCE/PIPELINE_REGISTRY.md`
- [x] Register AI department in `GOVERNANCE/ARCHITECTURE_DECISIONS.md`

### Acceptance Criteria

- [x] Complex requests use GPT-4o-mini; simple requests use Gemini 1.5 Flash (free tier)
- [x] Failed model tier falls back to the other tier after 3 linear-backoff retries
- [x] All secrets loaded from environment — never hardcoded
- [x] Read-only enforcement blocks any write attempt

---

## Phase 2 — Repository Intelligence ✅

**Goal:** Give the AI full read understanding of the Umakraft repository.

### Tasks

- [x] Implement `REPOSITORY_INDEXER` — file scanner, document classifier, chunk builder
- [x] Implement `VECTOR_DATABASE` — Qdrant backend via `@qdrant/js-client-rest`; collection `umakraft`; HNSW native index; cosine similarity
- [x] Implement `RAG_ENGINE` — retrieval pipeline: query → embed → search → rank → return
- [x] Implement `REPOSITORY_ENGINE` — orchestrates indexer, vector database, and RAG
- [x] Implement `CONTEXT_BUILDER` — assembles retrieved chunks into a coherent prompt context
- [x] Run initial full index of the repository

### Acceptance Criteria

- [x] All Markdown, JS, and governance files are indexed
- [x] Semantic search returns relevant results for a repository question
- [x] Context window stays within provider token limits
- [x] Source citations (file path + section heading) are attached to every answer

---

## Phase 3 — Knowledge Engine

**Goal:** Equip the AI with Umamusume domain knowledge.

### Tasks

- [x] Implement `KNOWLEDGE_ENGINE` — Umamusume facts, mechanics, terminology
- [x] Build glossary: MANT, fan gain, circle rank, trainer level, skill cards
- [x] Integrate knowledge engine with context builder
- [x] Add Umamusume classification branch to Topic Filter

### Acceptance Criteria

- [x] AI correctly explains MANT, fan gain, and circle mechanics
- [x] AI correctly identifies and rejects off-topic Umamusume sub-questions (e.g. horse racing trivia)
- [x] Glossary lookup `/ai glossary <term>` returns accurate definitions

---

## Phase 4 — Content Generation

**Goal:** Enable community message generation.

### Tasks

- [x] Implement `CONTENT_GENERATOR` — message generation pipeline
- [x] Implement `MESSAGE_SYSTEM` — template registry and output formatting
- [x] Implement `PROMPT_SYSTEM` — prompt builder with variable injection
- [x] Create prompt templates: `prompts/Greeting.md`, `prompts/Milestone.md`, `prompts/Achievement.md`, `prompts/Leaderboard.md`, `prompts/Warning.md`, `prompts/Reminder.md`, `prompts/Documentation.md`
- [x] Enforce 100–150 word output limit via `RESPONSE_VALIDATOR`

### Acceptance Criteria

- [x] `/ai message greeting` generates a 100–150 word greeting
- [x] Generated messages do not contain prohibited content
- [x] Message output passes the response validator

---

## Phase 5 — Command Surface ✅

**Goal:** Expose the AI Knowledge Service to Discord users via slash commands.

### Tasks

- [x] Implement `TOPIC_FILTER` — repository / umamusume / live / message / off-topic classification; complexity tier (`simple` | `complex`) as a second output on every non-rejected request
- [x] Implement `RESPONSE_VALIDATOR` — scope check, grammar check, length check, hallucination check (completed in Phase 4)
- [x] Register slash commands in `Distribution/Discord/deploy-commands.js`: `/ask`, `/ai explain`, `/ai search`, `/ai docs`, `/ai glossary`, `/ai message`, `/ai live`
- [x] Route AI commands through `Distribution/Commands/handlers/` → AI Knowledge Service → Dispatcher (bypasses Coordinator's Umamoe→Refinery→Workshop chain)

### Acceptance Criteria

- [x] `/ask "explain fan gain"` returns an accurate repository-sourced answer (GPT-4o-mini for complex, Gemini for simple)
- [x] `/ask "who is the president"` returns a polite off-topic rejection
- [x] `/ai search "Miner"` returns relevant file references
- [x] `/ai live "top circles right now"` calls the Web Search Engine (Tavily primary)
- [x] Response validator blocks any answer that references out-of-scope content

---

## Phase 6 — Observability ✅

**Goal:** Make the AI subsystem fully observable and supervised.

### Tasks

- [x] Integrate with `Operation` health supervisor via `core/taskRegistry.js`
- [x] Add structured logging via `core/log.js`
- [x] Implement embedding cache warming on startup
- [x] Add response latency tracking
- [x] Add cache hit rate reporting

### Acceptance Criteria

- [x] Operation supervisor correctly reports AI health state
- [x] Cache hit rate is visible in logs
- [x] Average response latency is logged per request

---

## Phase 7 — Advanced Features ✅

**Goal:** Add power-user and quality-of-life features.

### Tasks

- [x] Conversation memory — short-term context across turns in a single session
- [x] Citation mode — append source file list to every answer
- [x] Confidence score — report retrieval confidence per answer
- [x] Multi-language support — respond in the user's language
- [ ] Blueprint validator — validate a blueprint document against governance rules
- [ ] Documentation quality checker — identify missing sections in documentation

### Acceptance Criteria

- [x] A follow-up question correctly uses context from the previous turn
- [x] Citation mode lists source files with section headings
- [x] Confidence score appears at the end of each answer

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
- `v1.1.0` — Phase 1 updated to reflect complexity-tier model routing and linear-backoff retry; Phase 2 names Qdrant as the vector DB backend; Phase 5 adds `/ai live` command, complexity routing to Topic Filter task, and correct Distribution routing (bypasses Coordinator)
- `v1.2.0` — Phase 3 complete: `KnowledgeEngine.js` (12 glossary terms, mechanic catalog, getContext/search/lookup/isUmamusumeTopic/allTerms, 32 tests passing). Phase 4 complete: `PromptSystem.js` (7 modes, variable injection, token logging), `ResponseValidator.js` (6 checks, all checks run in parallel, 60 tests passing), `ContentGenerator.js` (7 types, 2-attempt re-generation, typed fallbacks), `MessageSystem.js` (type registry, Discord formatter). Phase 5 complete: `TopicFilter.js` (keyword classifier, complexity tier, command overrides, audit log, 54 tests passing), `WebSearchEngine.js` (Search Manager with Tavily→Brave→Google CSE→SerpAPI failover, graceful empty-array degradation).
- `v1.3.0` — Phase 1 complete: `APIProvider.js` (complexity routing, key rotation, linear backoff, rate limiter, embedding), `Configuration.js` (all env vars, startup validation, `requireApiKey`), `Security.js` (system constraint block, input sanitisation, response inspection, audit logging), `Cache.js` (LRU stores, embedding + response caches, SHA-256 keys), 33 tests passing. Response cache TTL default corrected to 600000ms (10 min per spec).
- `v1.4.0` — Phase 2 complete: `VectorDatabase.js`, `RepositoryIndexer.js`, `RAGEngine.js`, `ContextBuilder.js`, `RepositoryEngine.js`. Fix: `APIProvider.embed()` now returns `{vector, model, tokens}` shape when cache hits. 35 tests passing.
- `v1.5.0` — Phase 5 complete: `TopicFilter.js` (54 tests), `WebSearchEngine.js` (4-provider chain), Discord commands registered, `aiGateway.js` orchestrates full lifecycle. All 214 tests passing.
- `v1.6.0` — Phase 6 complete: `AIObserver.js` — task registry integration, Operation Investigator hook, structured metrics, latency tracking by topic, cache warming (12 queries), indexer health reporting. Wired into `aiGateway.js`, `RepositoryIndexer.js`, `investigator.js`, `events/ready.js`. 25 tests passing. All 239 tests passing.
- `v1.7.0` — Phase 7 complete (4/6 tasks): `AdvancedFeatures.js` — conversation memory, citation mode, confidence score, multi-language detection. 38 tests. All 277 tests passing.
- `v1.8.0` — Agent Layer: `ToolRegistry.js` (8 tools, lazy imports, runtime registration), `ReflectionEngine.js` (5 checks: vague/too-short/low-confidence/contradiction/missing-chunks, re-search/re-phrase/reject actions), `Agent.js` (orchestrator: classify→plan→execute→build→generate→reflect loop, 3-attempt cycle, web escalation). Wired into `aiGateway.js` via `AI_AGENT_ENABLED` config flag. Non-breaking — classic pipeline remains default. 33 tests. All 310 tests passing across 8 phases.
