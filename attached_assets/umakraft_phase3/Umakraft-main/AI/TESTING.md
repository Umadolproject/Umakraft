# Testing

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This document defines the test strategy, test categories, and acceptance criteria for the Umakraft AI Knowledge Service. All tests must pass before any component is considered ready for deployment.

---

## Test Philosophy

- Every component is tested in isolation (unit) and as part of the pipeline (integration)
- No test may make a real AI provider call — all provider interactions are mocked
- No test may write to the repository or any database
- Tests must be deterministic and runnable without environment secrets

---

## Test Categories

### 1. Unit Tests

Tests for individual components in isolation.

| Component | Test File | Key Assertions |
|---|---|---|
| Topic Filter | `AI/test/topicFilter.test.js` | Correct classification for 20+ sample queries |
| Response Validator | `AI/test/responseValidator.test.js` | All 6 checks (scope, prohibited, secret, wordCount, citation, hallucination) |
| Context Builder | `AI/test/contextBuilder.test.js` | Deduplication, token budget enforcement, citation format |
| Cache | `AI/test/cache.test.js` | TTL expiry, LRU eviction, hit/miss events |
| Prompt System | `AI/test/promptSystem.test.js` | Variable injection, system constraint block presence, token trimming |
| Content Generator | `AI/test/contentGenerator.test.js` | All 7 message types, word count enforcement, fallback trigger |

---

### 2. Repository Indexer Tests

Tests for the indexing pipeline with a mock repository.

| Test | Description |
|---|---|
| Full index | Index a set of mock files; verify all chunks are stored |
| Incremental index | Modify one file; verify only that file is re-indexed |
| Exclusion rules | Verify `node_modules/`, `.env`, `.log` files are not indexed |
| Chunk size | Verify all chunks fall within 50–1200 characters |
| Heading extraction | Verify heading context is correctly assigned to each chunk |
| Checksum tracking | Verify unchanged files are skipped on incremental run |
| Department classification | Verify correct department is assigned per directory |
| Deletion detection | Verify embeddings are deleted when a source file is removed |

---

### 3. RAG Engine Tests

Tests for query embedding and chunk retrieval.

| Test | Description |
|---|---|
| Similarity threshold | Chunks below `RAG_MIN_SCORE` are excluded |
| Top-k limit | No more than `RAG_TOP_K` chunks returned |
| Minimum chunks | At least 3 chunks returned even if score is below threshold |
| Metadata filter | Department and file type filters work correctly |
| Token budget | Context is trimmed when token budget is exceeded |
| Empty result | Returns empty list gracefully when no relevant chunks exist |

---

### 4. Prompt System Tests

| Test | Description |
|---|---|
| System constraint block | Present in every prompt regardless of mode |
| Variable injection | All `{{variable}}` placeholders are replaced |
| Missing variable | Clear error when a required variable is absent |
| Token trimming | Context is trimmed when assembled prompt exceeds budget |
| Prompt injection prevention | User input cannot escape the `{{question}}` slot |

---

### 5. Message Generation Tests

One test per message type to confirm generation + validation passes:

| Test | Message Type | Variables |
|---|---|---|
| Greeting | `greeting` | `circleName=Rising Stars` |
| Milestone | `milestone` | `trainerName=Akira, milestoneValue=500000` |
| Achievement | `achievement` | `trainerName=Akira, achievementName=Top 10 Trainer` |
| Leaderboard | `leaderboard` | `topTrainers=[{name, rank, fans}]` |
| Warning | `warning` | `trainerName=Akira, deficitAmount=25000` |
| Reminder | `reminder` | `eventName=Monthly Ranking, eventDate=2026-07-30` |
| Documentation | `documentation` | `topic=fan gain calculation` |

Each test asserts:
- [ ] Word count between 100 and 150
- [ ] No prohibited content
- [ ] No secret patterns
- [ ] Response Validator returns `passed: true`

---

### 6. Security Tests

| Test | Description |
|---|---|
| Secret pattern in response | Validator hard-rejects any response containing an API key pattern |
| Prompt injection via user input | User input in `{{question}}` cannot override system constraint block |
| Off-topic rejection | Topic Filter rejects all queries from the off-topic list |
| Write attempt | Any component attempting a file write must throw immediately |
| `.env` not indexed | Indexer excludes `.env` files; none appear in Vector Database |

---

### 7. API Provider Tests

| Test | Description |
|---|---|
| Retry logic | Primary provider fails 3 times → fallback to secondary |
| Rate limit enforcement | Requests beyond `AI_RATE_LIMIT_RPM` are rejected |
| Mock provider | All tests use a mock provider returning deterministic responses |
| Embedding dimension | Embed returns a vector of length `VDB_EMBEDDING_DIM` |

---

### 8. Regression Tests

Run on every code change to catch regressions in core behaviour.

| Regression Test | Guard |
|---|---|
| Off-topic rejection still works | Topic Filter |
| System constraint block present | Prompt System |
| Secret patterns still detected | Response Validator |
| Response cache still invalidates on TTL | Cache |
| Read-only enforcement still blocks writes | Security layer |

---

## Acceptance Criteria

The AI Knowledge Service is considered ready for deployment when:

- [ ] All unit tests pass
- [ ] All indexer tests pass with the mock repository
- [ ] All RAG Engine tests pass
- [ ] All 7 message generation tests pass
- [ ] All 5 security tests pass
- [ ] All regression tests pass
- [ ] No test makes a real provider API call
- [ ] Test run completes in under 30 seconds

---

## Running Tests

```bash
# Run all AI tests
node AI/test/pipeline.test.js

# Run individual component tests
node AI/test/topicFilter.test.js
node AI/test/responseValidator.test.js
node AI/test/contentGenerator.test.js
```

---

## Related Documents

- `AI/ARCHITECTURE.md` — defines the system under test
- `AI/SECURITY.md` — security test requirements
- `AI/RESPONSE_VALIDATOR.md` — validator check definitions
- `AI/CONTENT_GENERATOR.md` — message generation tests
- `AI/CONFIGURATION.md` — test environment configuration

---

## Version History

- `v1.0.0` — Initial Testing specification; eight test categories; acceptance criteria; 30-second run target; no real provider calls rule
