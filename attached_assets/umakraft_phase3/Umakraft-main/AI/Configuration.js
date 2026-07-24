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

  openaiApiKey: null,
  geminiApiKey: null,
  openaiApiKey2: null,
  geminiApiKey2: null,

  qdrantUrl: null,
  qdrantApiKey: null,
  qdrantCollection: 'umakraft',
  vdbEmbeddingDim: 1536,
  vdbTopK: 8,
  vdbMinScore: 0.60,
  vdbIndexIntervalHours: 6,
  vdbQueryCacheTtlMs: 600_000,
  vdbBackupPath: '/data/vdb_backup',

  indexerEmbedConcurrency: 5,
  indexerChunkMinChars: 50,
  indexerChunkTargetChars: 800,
  indexerChunkMaxChars: 1200,
  indexerChunkOverlapChars: 100,

  cacheEnabled: true,
  cacheEmbeddingTtlMs: 3_600_000,
  cacheEmbeddingMax: 1000,
  cacheResponseTtlMs: 600_000,
  cacheResponseMax: 500,

  tavilyApiKey: null,
  braveSearchApiKey: null,
  tavilyApiKey2: null,
  braveSearchApiKey2: null,
  googleCseApiKey: null,
  googleCseCx: null,
  serpapiApiKey: null,
  searchMaxResults: 5,
  searchProviderTimeoutMs: 5_000,
  searchCacheTtlMs: 600_000,
  searchConfidenceFallback: 0.65,

  topicFilterConfidenceThreshold: 0.70,
  topicFilterAuditLog: true,

  messageMinWords: 100,
  messageMaxWords: 150,
  messageMaxRegenerations: 2,

  userRateLimitRpm: 10,
  guildRateLimitRpm: 60,

  aiOpsChannelId: null,
  auditLogEnabled: true,

  citationMode: true,
  confidenceScore: false,
  conversationMemory: false,
  reindexOnStartup: false,
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
