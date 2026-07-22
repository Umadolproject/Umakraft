---
name: AI Phases 3-5 implementation
description: What was built, key decisions, and test counts for AI Knowledge Service Phases 3-5.
---

## Summary

Phases 3, 4, and 5 of `AI/IMPLEMENTATION_PLAN.md` are fully implemented and tested.
All modules are ESM, read-only, and live under `AI/`.

## Phase 3 — KnowledgeEngine.js

- 12 glossary terms (MANT, Fan Gain, Circle Rank, Trainer Level, Fan Deficit, Milestone, Blueprint, Circle, Depot, Vault, Trend, Gain Source)
- Mechanic Catalog: Fan Gain Calculation, Trainer Trend Tiers, Fan Deficit, Milestone System
- Public API: `lookup(term)`, `search(query)`, `getContext(query)`, `isUmamusumeTopic(q)`, `allTerms()`
- Fuzzy scoring via `normalise()` + word-hit intersection
- `AI/test/phase3.test.js` — 32 tests, 0 failed

## Phase 4 — PromptSystem, ResponseValidator, ContentGenerator, MessageSystem

### PromptSystem.js
- 7 modes: repository, knowledge, message, search, explain, docs, glossary
- Delegates system constraint block prepending to `Security.buildSafePrompt()`
- `{{context}}` and `{{question}}` injection; arbitrary `variables` map for `{{key}}` substitutions
- Logs estimated token count per assembled prompt

### ResponseValidator.js
- 6 checks (all run synchronously in parallel): scope, prohibitedContent, secretPattern, wordCount, citation, hallucination
- Word count check: only for `message` classification; 100–150 word window from `config.messageMinWords/messageMaxWords`
- Citation check: only for `repository`; requires `Source: <path>` or `Sources:\n- <path>` pattern
- Hallucination check: warns on external non-uma.moe URLs and "as of today" phrases
- Secret patterns: OpenAI sk-, Google AIza, Bearer tokens, base64 >40 chars, GitHub ghp_
- Severity: hard-reject > regenerate > pass
- Returns `{ passed, checks, wordCount, failureReasons, action, regenerateInstruction }`

### ContentGenerator.js
- 7 types: greeting, milestone, achievement, leaderboard, warning, reminder, documentation
- Each type has `required[]`, `optional[]`, `buildPrompt(vars)`, `fallback(vars)` in inline registry
- 2-attempt re-generation with correction instruction appended; fallback on both failures
- Calls `PromptSystem.assemble('message', ...)` → `APIProvider.generate({ complexity: 'complex' })` → `ResponseValidator.validate(..., 'message')`
- `VALID_TYPES` exported for callers

### MessageSystem.js
- Thin routing layer over ContentGenerator; type registry with descriptions
- `generate(type, vars)` → ContentGenerator → `formatForDiscord(text)` (strips control chars, preserves newlines + Markdown)
- `listTypes()` returns `[{ type, description }]` for all 7 types
- Returns user-facing error string (not throw) for unknown type

- `AI/test/phase4.test.js` — 60 tests, 0 failed

## Phase 5 — TopicFilter, WebSearchEngine

### TopicFilter.js
- 5 topics: repository, umamusume, live, message, off-topic
- Two outputs per non-rejected request: topic + complexity tier (simple|complex)
- Keyword classifier first (fast); off-topic indicator check runs before other classifiers
- Complexity defaults: repository→always complex, message→always complex, umamusume/live→simple unless complexity keywords present
- Complexity keywords: explain, analyze, analyse, compare, strategy, why, how does, difference between, best way, recommend, guide, optimize, improve, in depth, detailed, breakdown, walk me through, step by step, architecture, design, pattern
- Command overrides: `/ai search`→repository/complex, `/ai docs`→repository/complex, `/ai glossary`→umamusume/simple, `/ai live`→live/simple, `/ai message`→message/complex
- Audit log: JSON to `core/log.js` info channel; controlled by `config.topicFilterAuditLog`
- Classification result: `{ topic, complexity, confidence, method, rejected, rejectionMessage }`

### WebSearchEngine.js
- Search Manager with 4-provider chain: Tavily → Brave → Google CSE → SerpAPI
- Failover only on HTTP error/timeout/rate-limit — NOT on empty results (empty is valid)
- Per-provider normaliser maps to shared chunk schema: `{ content, filePath, heading, score, source: 'web' }`
- Brave/Google CSE/SerpAPI score by rank decay (1.0 - i*0.05)
- Query scoping injects "uma.moe Umamusume Pretty Derby" when not already present
- `search(query, options)` — primary path; `searchFallback(query, localConfidence)` — only fires when confidence < `config.searchConfidenceFallback` (default 0.65)
- Caches results via `Cache.setResponse/getResponse`; graceful empty-array return when all providers fail

- `AI/test/phase5.test.js` — 54 tests, 0 failed

## Test totals (phases 1-5)

| Phase | Tests |
|-------|-------|
| 1 | 33 |
| 2 | 35 |
| 3 | 32 |
| 4 | 60 |
| 5 | 54 |
| **Total** | **214** |

## **Why** decisions

- `ContentGenerator` inlines all 7 type schemas (not .md file parsing) — more reliable than markdown parsing at runtime; .md files remain authoritative documentation.
- `ResponseValidator` checks run synchronously (not `Promise.all`) — all checks are pure string operations with no I/O; synchronous is faster and simpler.
- `TopicFilter` uses hit-count confidence scoring (not normalised probabilities) — sufficient precision for a keyword classifier; semantic embedding fallback is a future phase.
- `WebSearchEngine` does not import Tavily SDK — uses raw `fetch` to avoid adding a package dependency; Tavily's REST API is simple enough.
