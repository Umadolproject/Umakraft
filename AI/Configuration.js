// AI/Configuration.js
// Environment variable loader and startup validator for the AI Knowledge Service.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/CONFIGURATION.md
//
// All values have safe defaults. API keys are never logged or hardcoded.
// Call validate() once at startup — it throws with a clear message if the
// environment is misconfigured.

import log from '../core/log.js';

// ---------------------------------------------------------------------------
// Load configuration from environment with typed defaults
// ---------------------------------------------------------------------------

const config = {
  // ── AI Provider selection ─────────────────────────────────────────────────
  // 'cloud' (default) — OpenAI + Gemini via API keys
  // 'local'           — SmolLM2 (or AI_LOCAL_MODEL) running in-process
  aiProvider:     process.env.AI_PROVIDER       ?? 'cloud',
  localModelId:   process.env.AI_LOCAL_MODEL    ?? 'HuggingFaceTB/SmolLM2-360M-Instruct',

  // ── API Provider — Model Routing ──────────────────────────────────────────
  complexModel:       process.env.AI_COMPLEX_MODEL        ?? 'gpt-4o-mini',
  simpleModel:        process.env.AI_SIMPLE_MODEL         ?? 'gemini-1.5-flash',
  embeddingModel:     process.env.AI_EMBEDDING_MODEL      ?? 'text-embedding-3-small',
  maxRetries:     parseInt(process.env.AI_MAX_RETRIES        ?? '3',  10),
  retryBaseDelayMs: parseInt(process.env.AI_RETRY_BASE_DELAY_MS ?? '1000', 10),
  rateLimitRpm:   parseInt(process.env.AI_RATE_LIMIT_RPM    ?? '60', 10),

  // ── API Keys (never logged) ───────────────────────────────────────────────
  // Primary keys
  openaiApiKey:    process.env.OPENAI_API_KEY    ?? null,
  geminiApiKey:    process.env.GEMINI_API_KEY    ?? null,
  // Backup keys — rotated in automatically when the primary hits a 429
  openaiApiKey2:   process.env.OPENAI_API_KEY_2  ?? null,
  geminiApiKey2:   process.env.GEMINI_API_KEY_2  ?? null,

  // ── Vector Database (Qdrant) ──────────────────────────────────────────────
  qdrantUrl:        process.env.QDRANT_URL         ?? null,
  qdrantApiKey:     process.env.QDRANT_API_KEY     ?? null,
  qdrantCollection: process.env.QDRANT_COLLECTION  ?? 'umakraft',
  vdbEmbeddingDim:  parseInt(process.env.VDB_EMBEDDING_DIM          ?? '1536', 10),
  vdbTopK:          parseInt(process.env.VDB_TOP_K                  ?? '8',    10),
  vdbMinScore:  parseFloat(process.env.VDB_MIN_SCORE                ?? '0.60'),
  vdbIndexIntervalHours: parseInt(process.env.VDB_INDEX_INTERVAL_HOURS ?? '6',  10),
  vdbQueryCacheTtlMs:    parseInt(process.env.VDB_QUERY_CACHE_TTL_MS  ?? '600000', 10),
  vdbBackupPath:  process.env.VDB_BACKUP_PATH ?? '/data/vdb_backup',

  // ── Repository Indexer ────────────────────────────────────────────────────
  indexerEmbedConcurrency: parseInt(process.env.INDEXER_EMBED_CONCURRENCY  ?? '5',    10),
  indexerChunkMinChars:    parseInt(process.env.INDEXER_CHUNK_MIN_CHARS    ?? '50',   10),
  indexerChunkTargetChars: parseInt(process.env.INDEXER_CHUNK_TARGET_CHARS ?? '800',  10),
  indexerChunkMaxChars:    parseInt(process.env.INDEXER_CHUNK_MAX_CHARS    ?? '1200', 10),
  indexerChunkOverlapChars:parseInt(process.env.INDEXER_CHUNK_OVERLAP_CHARS ?? '100', 10),

  // ── Cache ─────────────────────────────────────────────────────────────────
  cacheEnabled:          (process.env.CACHE_ENABLED ?? 'true') !== 'false',
  cacheEmbeddingTtlMs:  parseInt(process.env.CACHE_EMBEDDING_TTL_MS ?? '3600000', 10),
  cacheEmbeddingMax:    parseInt(process.env.CACHE_EMBEDDING_MAX    ?? '1000',    10),
  cacheResponseTtlMs:   parseInt(process.env.CACHE_RESPONSE_TTL_MS  ?? '600000',  10),
  cacheResponseMax:     parseInt(process.env.CACHE_RESPONSE_MAX     ?? '500',     10),

  // ── Web Search Engine ─────────────────────────────────────────────────────
  // Primary keys
  tavilyApiKey:        process.env.TAVILY_API_KEY          ?? null,
  braveSearchApiKey:   process.env.BRAVE_SEARCH_API_KEY    ?? null,
  // Backup keys — rotated in automatically when the primary hits a 429
  tavilyApiKey2:       process.env.TAVILY_API_KEY_2        ?? null,
  braveSearchApiKey2:  process.env.BRAVE_SEARCH_API_KEY_2  ?? null,
  googleCseApiKey:    process.env.GOOGLE_CSE_API_KEY    ?? null,
  googleCseCx:        process.env.GOOGLE_CSE_CX         ?? null,
  serpapiApiKey:      process.env.SERPAPI_API_KEY       ?? null,
  searchMaxResults:   parseInt(process.env.SEARCH_MAX_RESULTS          ?? '5',    10),
  searchProviderTimeoutMs: parseInt(process.env.SEARCH_PROVIDER_TIMEOUT_MS ?? '5000',  10),
  searchCacheTtlMs:   parseInt(process.env.SEARCH_CACHE_TTL_MS          ?? '600000', 10),
  searchConfidenceFallback: parseFloat(process.env.SEARCH_CONFIDENCE_FALLBACK ?? '0.65'),

  // ── Topic Filter ──────────────────────────────────────────────────────────
  topicFilterConfidenceThreshold: parseFloat(process.env.TOPIC_FILTER_CONFIDENCE_THRESHOLD ?? '0.70'),
  topicFilterAuditLog: (process.env.TOPIC_FILTER_AUDIT_LOG ?? 'true') !== 'false',

  // ── Content Generator ─────────────────────────────────────────────────────
  messageMinWords:       parseInt(process.env.MESSAGE_MIN_WORDS       ?? '100', 10),
  messageMaxWords:       parseInt(process.env.MESSAGE_MAX_WORDS       ?? '150', 10),
  messageMaxRegenerations: parseInt(process.env.MESSAGE_MAX_REGENERATIONS ?? '2', 10),

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  userRateLimitRpm:  parseInt(process.env.AI_USER_RATE_LIMIT_RPM  ?? '10', 10),
  guildRateLimitRpm: parseInt(process.env.AI_GUILD_RATE_LIMIT_RPM ?? '60', 10),

  // ── Operations ────────────────────────────────────────────────────────────
  aiOpsChannelId:    process.env.AI_OPS_CHANNEL_ID   ?? null,
  auditLogEnabled:   (process.env.AI_AUDIT_LOG_ENABLED ?? 'true') !== 'false',

  // ── Feature Flags ─────────────────────────────────────────────────────────
  citationMode:         (process.env.AI_CITATION_MODE         ?? 'true')  !== 'false',
  confidenceScore:      (process.env.AI_CONFIDENCE_SCORE      ?? 'false') !== 'false',
  conversationMemory:   (process.env.AI_CONVERSATION_MEMORY   ?? 'false') !== 'false',
  reindexOnStartup:     (process.env.AI_REINDEX_ON_STARTUP    ?? 'false') !== 'false',
};

// ---------------------------------------------------------------------------
// Startup Validation
// ---------------------------------------------------------------------------

/**
 * Validate the loaded configuration.
 * Throws with a full list of errors if anything is misconfigured.
 * Call once during AI Knowledge Service startup.
 *
 * Phase 1: API keys are optional so the service can be coded without them.
 *          They will be required when the AI provider is first invoked.
 */
export function validate() {
  const errors = [];

  // Numeric sanity checks
  const positiveIntegers = [
    ['AI_MAX_RETRIES',             config.maxRetries],
    ['AI_RETRY_BASE_DELAY_MS',     config.retryBaseDelayMs],
    ['AI_RATE_LIMIT_RPM',          config.rateLimitRpm],
    ['VDB_EMBEDDING_DIM',          config.vdbEmbeddingDim],
    ['VDB_TOP_K',                  config.vdbTopK],
    ['VDB_INDEX_INTERVAL_HOURS',   config.vdbIndexIntervalHours],
    ['INDEXER_EMBED_CONCURRENCY',  config.indexerEmbedConcurrency],
    ['INDEXER_CHUNK_MIN_CHARS',    config.indexerChunkMinChars],
    ['INDEXER_CHUNK_TARGET_CHARS', config.indexerChunkTargetChars],
    ['INDEXER_CHUNK_MAX_CHARS',    config.indexerChunkMaxChars],
    ['CACHE_EMBEDDING_TTL_MS',     config.cacheEmbeddingTtlMs],
    ['CACHE_EMBEDDING_MAX',        config.cacheEmbeddingMax],
    ['CACHE_RESPONSE_TTL_MS',      config.cacheResponseTtlMs],
    ['CACHE_RESPONSE_MAX',         config.cacheResponseMax],
    ['MESSAGE_MIN_WORDS',          config.messageMinWords],
    ['MESSAGE_MAX_WORDS',          config.messageMaxWords],
  ];

  for (const [name, value] of positiveIntegers) {
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`${name} must be a positive integer (got: ${value})`);
    }
  }

  // MESSAGE_MIN_WORDS < MESSAGE_MAX_WORDS
  if (config.messageMinWords >= config.messageMaxWords) {
    errors.push(
      `MESSAGE_MIN_WORDS (${config.messageMinWords}) must be less than ` +
      `MESSAGE_MAX_WORDS (${config.messageMaxWords})`
    );
  }

  // VDB_MIN_SCORE in [0, 1]
  if (config.vdbMinScore < 0 || config.vdbMinScore > 1) {
    errors.push(`VDB_MIN_SCORE must be between 0 and 1 (got: ${config.vdbMinScore})`);
  }

  if (errors.length > 0) {
    const message =
      '[AI/Configuration] Startup validation failed:\n' +
      errors.map(e => `  • ${e}`).join('\n');
    log.error(message);
    throw new Error(message);
  }

  log.info('[AI/Configuration] Configuration validated successfully.');
}

/**
 * Assert that a specific API key is present.
 * Called by the API Provider immediately before making a provider call.
 *
 * @param {'openai'|'gemini'} provider
 */
export function requireApiKey(provider) {
  if (provider === 'openai' && !config.openaiApiKey) {
    throw new Error(
      '[AI/Configuration] OPENAI_API_KEY is not set. ' +
      'Add it as a Replit Secret before making OpenAI requests.'
    );
  }
  if (provider === 'gemini' && !config.geminiApiKey) {
    throw new Error(
      '[AI/Configuration] GEMINI_API_KEY is not set. ' +
      'Add it as a Replit Secret before making Gemini requests.'
    );
  }
}

export default config;
