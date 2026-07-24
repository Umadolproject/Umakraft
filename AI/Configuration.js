// AI/Configuration.js
// Configuration for the AI Knowledge Service.

import log from '../core/log.js';

const envInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  aiProvider: 'local',
  localModelId: process.env.AI_LOCAL_MODEL || 'HuggingFaceTB/SmolLM2-135M-Instruct',
  localModelDevice: process.env.AI_LOCAL_DEVICE || 'cpu',
  localModelIdleTimeoutMs: envInt('AI_LOCAL_IDLE_TIMEOUT_MS', 15 * 60 * 1000),
  localModelMaxConcurrency: envInt('AI_LOCAL_MAX_CONCURRENCY', 1),
  localModelGenerationTimeoutMs: envInt('AI_LOCAL_GENERATION_TIMEOUT_MS', 45 * 1000),
  localFailureThreshold: envInt('AI_LOCAL_FAILURE_THRESHOLD', 3),
  localDegradedModeMs: envInt('AI_LOCAL_DEGRADED_MS', 5 * 60 * 1000),

  complexModel: 'gpt-4o-mini',
  simpleModel: 'gemini-1.5-flash',
  embeddingModel: 'text-embedding-3-small',
  maxRetries: 3,
  retryBaseDelayMs: 1000,
  rateLimitRpm: 60,

  openaiApiKey:  process.env.OPENAI_API_KEY  || null,
  geminiApiKey:  process.env.GEMINI_API_KEY  || null,
  openaiApiKey2: process.env.OPENAI_API_KEY_2 || null,
  geminiApiKey2: process.env.GEMINI_API_KEY_2 || null,

  qdrantUrl:        process.env.QDRANT_URL        || null,
  qdrantApiKey:     process.env.QDRANT_API_KEY    || null,
  qdrantCollection: process.env.QDRANT_COLLECTION || 'umakraft',
  vdbEmbeddingDim:      envInt('VDB_EMBEDDING_DIM',        1536),
  vdbTopK:              envInt('VDB_TOP_K',                   8),
  vdbMinScore:          Number(process.env.VDB_MIN_SCORE ?? '0.60'),
  vdbIndexIntervalHours: envInt('VDB_INDEX_INTERVAL_HOURS',   6),
  vdbQueryCacheTtlMs:   envInt('VDB_QUERY_CACHE_TTL_MS', 600_000),
  vdbBackupPath: process.env.VDB_BACKUP_PATH || '/data/vdb_backup',

  indexerEmbedConcurrency: envInt('INDEXER_EMBED_CONCURRENCY',      5),
  indexerChunkMinChars:    envInt('INDEXER_CHUNK_MIN_CHARS',        50),
  indexerChunkTargetChars: envInt('INDEXER_CHUNK_TARGET_CHARS',    800),
  indexerChunkMaxChars:    envInt('INDEXER_CHUNK_MAX_CHARS',      1200),
  indexerChunkOverlapChars: envInt('INDEXER_CHUNK_OVERLAP_CHARS',  100),

  cacheEnabled:       (process.env.CACHE_ENABLED ?? 'true') !== 'false',
  cacheEmbeddingTtlMs: envInt('CACHE_EMBEDDING_TTL_MS', 3_600_000),
  cacheEmbeddingMax:   envInt('CACHE_EMBEDDING_MAX',       1000),
  cacheResponseTtlMs:  envInt('CACHE_RESPONSE_TTL_MS',  600_000),
  cacheResponseMax:    envInt('CACHE_RESPONSE_MAX',          500),

  tavilyApiKey:      process.env.TAVILY_API_KEY          || null,
  tavilyApiKey2:     process.env.TAVILY_API_KEY_2        || null,
  braveSearchApiKey: process.env.BRAVE_SEARCH_API_KEY    || null,
  braveSearchApiKey2: process.env.BRAVE_SEARCH_API_KEY_2 || null,
  googleCseApiKey:   process.env.GOOGLE_CSE_API_KEY      || null,
  googleCseCx:       process.env.GOOGLE_CSE_CX           || null,
  serpapiApiKey:     process.env.SERPAPI_API_KEY          || null,
  searchMaxResults:         envInt('SEARCH_MAX_RESULTS',             5),
  searchProviderTimeoutMs:  envInt('SEARCH_PROVIDER_TIMEOUT_MS',  5_000),
  searchCacheTtlMs:         envInt('SEARCH_CACHE_TTL_MS',       600_000),
  searchConfidenceFallback: Number(process.env.SEARCH_CONFIDENCE_FALLBACK ?? '0.65'),

  topicFilterConfidenceThreshold: Number(process.env.TOPIC_FILTER_CONFIDENCE_THRESHOLD ?? '0.70'),
  topicFilterAuditLog: (process.env.TOPIC_FILTER_AUDIT_LOG ?? 'true') !== 'false',

  messageMinWords:       envInt('MESSAGE_MIN_WORDS',        100),
  messageMaxWords:       envInt('MESSAGE_MAX_WORDS',        150),
  messageMaxRegenerations: envInt('MESSAGE_MAX_REGENERATIONS', 2),

  userRateLimitRpm:  envInt('AI_USER_RATE_LIMIT_RPM',  10),
  guildRateLimitRpm: envInt('AI_GUILD_RATE_LIMIT_RPM', 60),

  aiOpsChannelId: process.env.AI_OPS_CHANNEL_ID || null,
  auditLogEnabled:    (process.env.AI_AUDIT_LOG_ENABLED ?? 'true') !== 'false',

  citationMode:       (process.env.AI_CITATION_MODE       ?? 'true')  !== 'false',
  confidenceScore:    (process.env.AI_CONFIDENCE_SCORE    ?? 'false') === 'true',
  conversationMemory: (process.env.AI_CONVERSATION_MEMORY ?? 'false') === 'true',
  reindexOnStartup:   (process.env.AI_REINDEX_ON_STARTUP  ?? 'false') === 'true',
};

export function validate() {
  const errors = [];

  const positiveIntegers = [
    ['localModelIdleTimeoutMs', config.localModelIdleTimeoutMs],
    ['localModelMaxConcurrency', config.localModelMaxConcurrency],
    ['localModelGenerationTimeoutMs', config.localModelGenerationTimeoutMs],
    ['localFailureThreshold', config.localFailureThreshold],
    ['localDegradedModeMs', config.localDegradedModeMs],
    ['maxRetries', config.maxRetries],
    ['retryBaseDelayMs', config.retryBaseDelayMs],
    ['rateLimitRpm', config.rateLimitRpm],
    ['vdbEmbeddingDim', config.vdbEmbeddingDim],
    ['vdbTopK', config.vdbTopK],
    ['vdbIndexIntervalHours', config.vdbIndexIntervalHours],
    ['indexerEmbedConcurrency', config.indexerEmbedConcurrency],
    ['indexerChunkMinChars', config.indexerChunkMinChars],
    ['indexerChunkTargetChars', config.indexerChunkTargetChars],
    ['indexerChunkMaxChars', config.indexerChunkMaxChars],
    ['cacheEmbeddingTtlMs', config.cacheEmbeddingTtlMs],
    ['cacheEmbeddingMax', config.cacheEmbeddingMax],
    ['cacheResponseTtlMs', config.cacheResponseTtlMs],
    ['cacheResponseMax', config.cacheResponseMax],
    ['messageMinWords', config.messageMinWords],
    ['messageMaxWords', config.messageMaxWords],
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
    const message = [
      '[AI/Configuration] Startup validation failed:',
      ...errors.map(error => `  • ${error}`),
    ].join('\n');
    log.error(message);
    throw new Error(message);
  }

  log.info('[AI/Configuration] Configuration validated successfully.');
}

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
