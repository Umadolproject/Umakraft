/**
 * Miner Configuration
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Miner — Stage 1, Umamoe
 *
 * All API configuration is centralised here.
 * Never hardcode values elsewhere in the Miner.
 */

export const API_CONFIG = {
  baseUrl: process.env.UMA_MOE_API_BASE_URL || 'https://uma.moe/api',
  timeoutMs: parseInt(process.env.API_TIMEOUT_MS || '30000', 10),
  maxRetries: parseInt(process.env.API_MAX_RETRIES || '3', 10),
  initialBackoffMs: parseInt(process.env.API_RETRY_BACKOFF_MS || '1000', 10),
  maxBackoffMs: 60000,
  backoffMultiplier: 2,
  jitterRange: 0.1, // ±10% random variance
};

/**
 * Approved endpoints only.
 * Any endpoint not listed here must not be requested.
 */
export const ENDPOINTS = {
  health:   '/health',
  trainer:  '/trainers/{id}',
  search:   '/v3/search',
  rankings: '/rankings',
  stats:    '/stats',
};

/**
 * HTTP status codes the Miner must handle.
 * true  = transient (retriable)
 * false = permanent (do not retry)
 */
export const STATUS_RETRIABLE = {
  429: true,
  500: true,
  502: true,
  503: true,
  504: true,
  400: false,
  401: false,
  403: false,
  404: false,
};
