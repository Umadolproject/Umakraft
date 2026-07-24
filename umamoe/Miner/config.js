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
  baseUrl:          process.env.UMA_MOE_API_BASE_URL ?? 'https://uma.moe/api',
  apiKey:           process.env.UMA_MOE_API_KEY ?? '',
  timeoutMs:        30_000,
  maxRetries:       3,
  initialBackoffMs: 1_000,
  maxBackoffMs:     60_000,
  backoffMultiplier: 2,
  jitterRange:      0.1, // ±10% random variance
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
