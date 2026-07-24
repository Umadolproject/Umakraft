# Configuration

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.1.0
**Last Updated:** 2026-07-22

---

## Purpose

This document defines all environment variables and configuration values used by the Umakraft AI Knowledge Service. No configuration value is hardcoded — all are loaded from environment variables at startup.

API keys and secrets are never documented with their values here. This document describes the variable name, type, default, and purpose only.

---

## Environment Variables

### API Provider — Model Routing

The AI Knowledge Service uses two AI models selected by complexity tier (set by the Topic Filter).

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `AI_COMPLEX_MODEL` | string | `gpt-4o-mini` | No | Model for complex requests (codebase, strategy, message generation) |
| `AI_SIMPLE_MODEL` | string | `gemini-1.5-flash` | No | Model for simple requests — Gemini free tier |
| `AI_EMBEDDING_MODEL` | string | `text-embedding-3-small` | No | Embedding model for indexing and query (OpenAI) |
| `AI_MAX_RETRIES` | number | `3` | No | Max retry attempts before falling back to the other model tier |
| `AI_RETRY_BASE_DELAY_MS` | number | `1000` | No | Base delay in ms for linear backoff (actual delay = `base * attempt`) |
| `AI_RATE_LIMIT_RPM` | number | `60` | No | Max requests per minute across both model tiers |

### API Keys (Secrets)

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | Yes | OpenAI key — used for `AI_COMPLEX_MODEL` and `AI_EMBEDDING_MODEL` |
| `GEMINI_API_KEY` | Yes | Google Gemini key — used for `AI_SIMPLE_MODEL` |

All API keys must be stored as Replit Secrets. They are never committed to source code, never logged, and never included in prompts or responses.

---

### Vector Database (Qdrant)

Qdrant is the selected vector database backend. The Qdrant client (`@qdrant/js-client-rest`) reads the three connection vars at startup. If `QDRANT_URL` is not set, the Vector Database falls back to an in-memory store (development/testing only — data does not survive restarts).

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `QDRANT_URL` | string | — | No* | Qdrant managed service URL. Omit to use in-memory fallback. |
| `QDRANT_API_KEY` | string | — | No* | Qdrant API key (Replit Secret). Required when `QDRANT_URL` is set. |
| `QDRANT_COLLECTION` | string | `umakraft` | No | Collection name for the full repository index |
| `VDB_EMBEDDING_DIM` | number | `1536` | No | Embedding vector dimension — must match `AI_EMBEDDING_MODEL` |
| `VDB_TOP_K` | number | `8` | No | Maximum chunks returned per similarity search (used by RAG Engine) |
| `VDB_MIN_SCORE` | number | `0.60` | No | Minimum cosine similarity score to include a result (used by RAG Engine) |
| `VDB_INDEX_INTERVAL_HOURS` | number | `6` | No | Hours between incremental index runs |
| `VDB_QUERY_CACHE_TTL_MS` | number | `600000` | No | TTL for vector database query cache (ms) |
| `VDB_BACKUP_PATH` | string | `/data/vdb_backup` | No | Directory for JSON backup exports |

### RAG Engine

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `RAG_MAX_CONTEXT_TOKENS` | number | `6000` | No | Maximum tokens the RAG Engine may fill in the context window |
| `RAG_MIN_CHUNKS` | number | `3` | No | Minimum chunks returned even if some fall below `VDB_MIN_SCORE` threshold |

*\* `QDRANT_URL` and `QDRANT_API_KEY` are optional during development. The in-memory fallback is automatically used when `QDRANT_URL` is absent. Both are required for production deployments.*

---

### Repository Indexer

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `INDEXER_EMBED_CONCURRENCY` | number | `5` | No | Max parallel embedding calls during indexing |
| `INDEXER_CHUNK_MIN_CHARS` | number | `50` | No | Minimum characters per chunk — shorter chunks are skipped |
| `INDEXER_CHUNK_TARGET_CHARS` | number | `800` | No | Target characters per chunk |
| `INDEXER_CHUNK_MAX_CHARS` | number | `1200` | No | Maximum characters per chunk |
| `INDEXER_CHUNK_OVERLAP_CHARS` | number | `100` | No | Overlap between adjacent chunks |

---

### Cache

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `CACHE_ENABLED` | boolean | `true` | No | Enable or disable all caching |
| `CACHE_EMBEDDING_TTL_MS` | number | `3600000` | No | Embedding cache TTL (1 hour) |
| `CACHE_EMBEDDING_MAX` | number | `1000` | No | Max embedding cache entries |
| `CACHE_RESPONSE_TTL_MS` | number | `600000` | No | Response cache TTL (10 minutes) |
| `CACHE_RESPONSE_MAX` | number | `500` | No | Max response cache entries |

---

### Web Search Engine

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `TAVILY_API_KEY` | string | — | Yes | Tavily Search API key (primary search provider) |
| `BRAVE_SEARCH_API_KEY` | string | — | Yes | Brave Search API key (fallback 1) |
| `GOOGLE_CSE_API_KEY` | string | — | Yes | Google Custom Search JSON API key (fallback 2) |
| `GOOGLE_CSE_CX` | string | — | Yes | Google Custom Search Engine ID (fallback 2) |
| `SERPAPI_API_KEY` | string | — | Yes | SerpAPI key (fallback 3 — last resort) |
| `SEARCH_MAX_RESULTS` | number | `5` | No | Max results per call, all providers |
| `SEARCH_PROVIDER_TIMEOUT_MS` | number | `5000` | No | Per-provider timeout before failover |
| `SEARCH_CACHE_TTL_MS` | number | `600000` | No | Cache duration in ms for identical queries (10 min) |
| `SEARCH_CONFIDENCE_FALLBACK` | number | `0.65` | No | RAG confidence score below which web search is also called |

---

### Topic Filter

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `TOPIC_FILTER_CONFIDENCE_THRESHOLD` | number | `0.70` | No | Minimum confidence for semantic classification before defaulting to off-topic |
| `TOPIC_FILTER_AUDIT_LOG` | boolean | `true` | No | Log every classification decision including complexity tier |

---

### Content Generator

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `MESSAGE_MIN_WORDS` | number | `100` | No | Minimum word count for generated messages |
| `MESSAGE_MAX_WORDS` | number | `150` | No | Maximum word count for generated messages |
| `MESSAGE_MAX_REGENERATIONS` | number | `2` | No | Max re-generation attempts before returning fallback |

---

### Rate Limiting

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `AI_USER_RATE_LIMIT_RPM` | number | `10` | No | Max requests per minute per Discord user |
| `AI_GUILD_RATE_LIMIT_RPM` | number | `60` | No | Max requests per minute for the entire guild |

---

### Operations

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `AI_OPS_CHANNEL_ID` | string | — | No | Discord channel ID for AI operation alerts (falls back to `OPS_CHANNEL_ID` if not set) |
| `AI_AUDIT_LOG_ENABLED` | boolean | `true` | No | Enable structured audit logging for all AI requests |

---

## Configuration Validation

On startup, the AI Knowledge Service validates:

1. At least one provider API key is present (corresponding to `AI_PRIMARY_PROVIDER`)
2. `VDB_EMBEDDING_DIM` matches the dimension of `AI_EMBEDDING_MODEL`
3. `MESSAGE_MIN_WORDS` is less than `MESSAGE_MAX_WORDS`
4. All numeric values are positive

If validation fails, startup is aborted with a clear error message listing every misconfigured variable.

---

## Feature Flags

| Variable | Type | Default | Description |
|---|---|---|---|
| `AI_CITATION_MODE` | boolean | `true` | Append source citations to repository answers |
| `AI_CONFIDENCE_SCORE` | boolean | `false` | Append confidence score to repository answers |
| `AI_CONVERSATION_MEMORY` | boolean | `false` | Enable short-term session memory (Phase 7) |
| `AI_REINDEX_ON_STARTUP` | boolean | `false` | Force a full re-index on every startup |

---

## Best Practices

- Use Replit Secrets for all API keys — never hardcode them
- The two-model setup (`AI_COMPLEX_MODEL` + `AI_SIMPLE_MODEL`) is driven by the Topic Filter complexity tier; never override it per-request without a documented reason
- Qdrant is the production vector store; the JSON backup (`VDB_BACKUP_PATH`) is a supplementary safety net, not a restore path
- Monitor `AI_RATE_LIMIT_RPM` against actual usage — for 30 users the default of 60 RPM is ample but lower it if provider costs spike unexpectedly
- All five search provider keys must be present at startup even if the top-priority providers rarely fail — the fallback chain requires them

---

## Related Documents

- `AI/API_PROVIDER.md` — consumes provider configuration
- `AI/VECTOR_DATABASE.md` — consumes VDB configuration
- `AI/CACHE.md` — consumes cache configuration
- `AI/SECURITY.md` — API key handling rules
- `AI/TESTING.md` — configuration validation tests

---

## Version History

- `v1.0.0` — Initial Configuration specification; all environment variables for all six component groups; startup validation; feature flags
- `v1.1.0` — Replaced single-provider vars with complexity-tier model vars (`AI_COMPLEX_MODEL`, `AI_SIMPLE_MODEL`); API keys reduced to OpenAI + Gemini only; VDB section replaced with Qdrant vars (`QDRANT_URL`, `QDRANT_API_KEY`, `QDRANT_COLLECTION`); Web Search Engine section added (five provider keys + four tuning vars); retry note corrected to linear backoff
- `v1.2.0` — `QDRANT_URL` and `QDRANT_API_KEY` marked optional (in-memory fallback when absent); RAG Engine section added with `RAG_MAX_CONTEXT_TOKENS` and `RAG_MIN_CHUNKS`; `VDB_TOP_K` and `VDB_MIN_SCORE` descriptions updated to note RAG Engine usage
