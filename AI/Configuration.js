// AI/Configuration.js
// Configuration for the AI Knowledge Service.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/CONFIGURATION.md
//
// API keys are loaded from environment variables (set as Railway secrets).
// All other values are hardcoded constants — edit this file to change them.
// Call validate() once at startup.

import log from '../core/log.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const config = {
  // ── AI Provider selection ─────────────────────────────────────────────────
  // 'local' — SmolLM2 running in-process via @huggingface/transformers
  // 'cloud' — OpenAI (complex) + Gemini (simple) via API keys
  aiProvider:   'local',
  localModelId: 'HuggingFaceTB/SmolLM2-360M-Instruct',

  // ── API Provider — Model Routing ──────────────────────────────────────────
  complexModel:     'gpt-4o-mini',
  simpleModel:      'gemini-1.5-flash',
  embeddingModel:   'text-embedding-3-small',
  maxRetries:       3,
  retryBaseDelayMs: 1000,
  rateLimitRpm:     60,

  // ── API Keys (never logged) — set as environment secrets ─────────────────
  openaiApiKey:  process.env.OPENAI_API_KEY    ?? null,
  geminiApiKey:  process.env.GEMINI_API_KEY    ?? null,
  openaiApiKey2: process.env.OPENAI_API_KEY_2  ?? null,
  geminiApiKey2: process.env.GEMINI_API_KEY_2  ?? null,

  // ── Vector Database (Qdrant) ──────────────────────────────────────────────
  qdrantUrl:             process.env.QDRANT_URL     ?? null,
  qdrantApiKey:          process.env.QDRANT_API_KEY ?? null,
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

  // ── Web Search Engine ─────────────────────────────────────────────────────
  tavilyApiKey:            process.env.TAVILY_API_KEY         ?? null,
  braveSearchApiKey:       process.env.BRAVE_SEARCH_API_KEY   ?? null,
  tavilyApiKey2:           process.env.TAVILY_API_KEY_2       ?? null,
  braveSearchApiKey2:      process.env.BRAVE_SEARCH_API_KEY_2 ?? null,
  googleCseApiKey:         process.env.GOOGLE_CSE_API_KEY     ?? null,
  googleCseCx:             null,  // Optional — set here if using Google CSE (not a secret)
  serpapiApiKey:           process.env.SERPAPI_API_KEY        ?? null,
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
  aiOpsChannelId:  null,   // Use OPS_CHANNEL_ID in core/botConfig.js instead
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

  // Numeric sanity checks
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

  // messageMinWords < messageMaxWords
  if (config.messageMinWords >= config.messageMaxWords) {
    errors.push(
      `messageMinWords (${config.messageMinWords}) must be less than ` +
      `messageMaxWords (${config.messageMaxWords})`
    );
  }

  // vdbMinScore in [0, 1]
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
 * Called by the API Provider immediately before making a provider call.
 *
 * @param {'openai'|'gemini'} provider
 */
export function requireApiKey(provider) {
  if (provider === 'openai' && !config.openaiApiKey) {
    throw new Error(
      '[AI/Configuration] OPENAI_API_KEY is not set. ' +
      'Add it as a Railway secret / Replit Secret before making OpenAI requests.'
    );
  }
  if (provider === 'gemini' && !config.geminiApiKey) {
    throw new Error(
      '[AI/Configuration] GEMINI_API_KEY is not set. ' +
      'Add it as a Railway secret / Replit Secret before making Gemini requests.'
    );
  }
}

export default config;
