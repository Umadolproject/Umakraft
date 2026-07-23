// AI/Configuration.js
// Configuration for the AI Knowledge Service.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/CONFIGURATION.md
//
// All values are hardcoded constants — edit this file to change them.
// The only environment secret this project requires is DISCORD_TOKEN
// (set in Railway Variables / Replit Secrets).
//
// If you switch aiProvider to 'cloud', also set these secrets:
//   OPENAI_API_KEY, GEMINI_API_KEY (and optionally their _2 backups)
//   QDRANT_URL, QDRANT_API_KEY (or remove to use in-memory vector DB)
//   TAVILY_API_KEY, BRAVE_SEARCH_API_KEY, etc. (for web search)

import log from '../core/log.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const config = {
  // ── AI Provider selection ─────────────────────────────────────────────────
  // 'local' — SmolLM2 running in-process via @huggingface/transformers
  // 'cloud' — OpenAI (complex) + Gemini (simple) via API keys
  aiProvider:   'local',
  // The 135M quantised model keeps Railway's bot process comfortably below
  // constrained memory limits. Override with AI_LOCAL_MODEL when needed.
  localModelId: process.env.AI_LOCAL_MODEL || 'HuggingFaceTB/SmolLM2-135M-Instruct',

  // ── API Provider — Model Routing (cloud mode only) ────────────────────────
  complexModel:     'gpt-4o-mini',
  simpleModel:      'gemini-1.5-flash',
  embeddingModel:   'text-embedding-3-small',
  maxRetries:       3,
  retryBaseDelayMs: 1000,
  rateLimitRpm:     60,

  // ── API Keys (cloud mode only) ────────────────────────────────────────────
  // Set these as secrets only if switching aiProvider to 'cloud'.
  openaiApiKey:  null,
  geminiApiKey:  null,
  openaiApiKey2: null,
  geminiApiKey2: null,

  // ── Vector Database (Qdrant) ──────────────────────────────────────────────
  // qdrantUrl / qdrantApiKey default to null → uses fast in-memory backend.
  // Set them as secrets only if you want persistent Qdrant Cloud storage.
  qdrantUrl:             null,
  qdrantApiKey:          null,
  qdrantCollection:      'umakraft',
  vdbEmbeddingDim:       1536,
  vdbTopK:               8,
  vdbMinScore:           0.60,
  vdbIndexIntervalHours: 6,
  vdbQueryCacheTtlMs:    600_000,
  vdbBackupPath:         '/data/vdb_backup',

  // ── Repository Indexer ────────────────────────────────────────────────────
  indexerEmbedConcurrency:  5,
  indexerChunkMinChars:     50,
  indexerChunkTargetChars:  800,
  indexerChunkMaxChars:     1200,
  indexerChunkOverlapChars: 100,

  // ── Cache ─────────────────────────────────────────────────────────────────
  cacheEnabled:        true,
  cacheEmbeddingTtlMs: 3_600_000,
  cacheEmbeddingMax:   1000,
  cacheResponseTtlMs:  600_000,
  cacheResponseMax:    500,

  // ── Web Search Engine (cloud mode only) ───────────────────────────────────
  // Set search API keys as secrets only if switching aiProvider to 'cloud'.
  tavilyApiKey:            null,
  braveSearchApiKey:       null,
  tavilyApiKey2:           null,
  braveSearchApiKey2:      null,
  googleCseApiKey:         null,
  googleCseCx:             null,
  serpapiApiKey:           null,
  searchMaxResults:        5,
  searchProviderTimeoutMs: 5_000,
  searchCacheTtlMs:        600_000,
  searchConfidenceFallback: 0.65,

  // ── Topic Filter ──────────────────────────────────────────────────────────
  topicFilterConfidenceThreshold: 0.70,
  topicFilterAuditLog:            true,

  // ── Content Generator ─────────────────────────────────────────────────────
  messageMinWords:         100,
  messageMaxWords:         150,
  messageMaxRegenerations: 2,

  // ── Rate Limiting ─────────────────────────────────────────────────────────
  userRateLimitRpm:  10,
  guildRateLimitRpm: 60,

  // ── Operations ────────────────────────────────────────────────────────────
  aiOpsChannelId:  null,
  auditLogEnabled: true,

  // ── Feature Flags ─────────────────────────────────────────────────────────
  citationMode:       true,
  confidenceScore:    false,
  conversationMemory: false,
  reindexOnStartup:   false,
};

// ---------------------------------------------------------------------------
// Startup Validation
// ---------------------------------------------------------------------------

/**
 * Validate the loaded configuration.
 * Throws with a full list of errors if anything is misconfigured.
 * Call once during AI Knowledge Service startup.
 */
export function validate() {
  const errors = [];

  const positiveIntegers = [
    ['maxRetries',            config.maxRetries],
    ['retryBaseDelayMs',      config.retryBaseDelayMs],
    ['rateLimitRpm',          config.rateLimitRpm],
    ['vdbEmbeddingDim',       config.vdbEmbeddingDim],
    ['vdbTopK',               config.vdbTopK],
    ['vdbIndexIntervalHours', config.vdbIndexIntervalHours],
    ['indexerEmbedConcurrency',  config.indexerEmbedConcurrency],
    ['indexerChunkMinChars',     config.indexerChunkMinChars],
    ['indexerChunkTargetChars',  config.indexerChunkTargetChars],
    ['indexerChunkMaxChars',     config.indexerChunkMaxChars],
    ['cacheEmbeddingTtlMs',  config.cacheEmbeddingTtlMs],
    ['cacheEmbeddingMax',    config.cacheEmbeddingMax],
    ['cacheResponseTtlMs',   config.cacheResponseTtlMs],
    ['cacheResponseMax',     config.cacheResponseMax],
    ['messageMinWords',      config.messageMinWords],
    ['messageMaxWords',      config.messageMaxWords],
  ];

  for (const [name, value] of positiveIntegers) {
    if (!Number.isFinite(value) || value <= 0) {
      errors.push(`${name} must be a positive integer (got: ${value})`);
    }
  }

  if (config.messageMinWords >= config.messageMaxWords) {
    errors.push(
      `messageMinWords (${config.messageMinWords}) must be less than ` +
      `messageMaxWords (${config.messageMaxWords})`
    );
  }

  if (config.vdbMinScore < 0 || config.vdbMinScore > 1) {
    errors.push(`vdbMinScore must be between 0 and 1 (got: ${config.vdbMinScore})`);
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
 * Only relevant when aiProvider is 'cloud'.
 *
 * @param {'openai'|'gemini'} provider
 */
export function requireApiKey(provider) {
  if (provider === 'openai' && !config.openaiApiKey) {
    throw new Error(
      '[AI/Configuration] openaiApiKey is not set. ' +
      'Add OPENAI_API_KEY as a secret to use cloud mode.'
    );
  }
  if (provider === 'gemini' && !config.geminiApiKey) {
    throw new Error(
      '[AI/Configuration] geminiApiKey is not set. ' +
      'Add GEMINI_API_KEY as a secret to use cloud mode.'
    );
  }
}

export default config;
