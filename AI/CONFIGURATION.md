# Configuration

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

This document defines all environment variables and configuration values used by the Umakraft AI Knowledge Service. No configuration value is hardcoded — all are loaded from environment variables at startup.

API keys and secrets are never documented with their values here. This document describes the variable name, type, default, and purpose only.

---

## Environment Variables

### API Provider

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `AI_PRIMARY_PROVIDER` | string | `openai` | No | Primary AI provider (`openai`, `gemini`, `claude`, `openrouter`, `ollama`) |
| `AI_SECONDARY_PROVIDER` | string | `gemini` | No | Fallback provider when primary is unavailable |
| `AI_PRIMARY_MODEL` | string | `gpt-4o-mini` | No | Primary chat model |
| `AI_SECONDARY_MODEL` | string | `gemini-1.5-flash` | No | Fallback chat model |
| `AI_EMBEDDING_MODEL` | string | `text-embedding-3-small` | No | Embedding model for indexing and query |
| `AI_MAX_RETRIES` | number | `3` | No | Max retry attempts per provider before fallback |
| `AI_RETRY_BASE_DELAY_MS` | number | `1000` | No | Base delay in ms for exponential backoff |
| `AI_RATE_LIMIT_RPM` | number | `60` | No | Max requests per minute to any single provider |

### API Keys (Secrets)

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | If using OpenAI | OpenAI API key |
| `GEMINI_API_KEY` | If using Gemini | Google Gemini API key |
| `ANTHROPIC_API_KEY` | If using Claude | Anthropic API key |
| `OPENROUTER_API_KEY` | If using OpenRouter | OpenRouter API key |
| `OLLAMA_BASE_URL` | If using Ollama | Base URL for local Ollama server (default: `http://localhost:11434`) |

All API keys must be stored as Replit Secrets (or equivalent). They are never committed to source code, never logged, and never included in prompts or responses.

---

### Vector Database

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `VDB_BACKEND` | string | `memory` | No | Storage backend (`memory`, `sqlite`, `qdrant`, `pinecone`) |
| `VDB_EMBEDDING_DIM` | number | `1536` | No | Embedding vector dimension — must match embedding model |
| `VDB_TOP_K` | number | `8` | No | Maximum chunks returned per similarity search |
| `VDB_MIN_SCORE` | number | `0.60` | No | Minimum cosine similarity score to include a result |
| `VDB_INDEX_INTERVAL_HOURS` | number | `6` | No | Hours between incremental index runs |
| `VDB_QUERY_CACHE_TTL_MS` | number | `600000` | No | TTL for vector database query cache (ms) |
| `VDB_BACKUP_PATH` | string | `/data/vdb_backup` | No | Directory for embedding store backups |

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

### Topic Filter

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `TOPIC_FILTER_CONFIDENCE_THRESHOLD` | number | `0.70` | No | Minimum confidence for semantic classification before defaulting to off-topic |
| `TOPIC_FILTER_AUDIT_LOG` | boolean | `true` | No | Log every classification decision |

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
- Keep `AI_PRIMARY_MODEL` as the cheapest model that meets quality requirements — upgrade only for complex queries
- Set `VDB_BACKEND=sqlite` for production deployments to ensure index persistence across restarts
- Monitor `AI_RATE_LIMIT_RPM` against actual usage — too low causes user-visible throttling; too high risks unexpected provider costs

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
