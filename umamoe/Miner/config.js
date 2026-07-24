/**
 * Miner Configuration
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Miner — Stage 1, Umamoe
 *
 * All API configuration is centralised here.
 * Never hardcode values elsewhere in the Miner.
 *
 * Base URL: https://uma.moe/api
 * Auth:     X-API-Key header  (UMA_MOE_API_KEY env var)
 *
 * Verified working endpoints (live-probed 2026-07-20, see docs/UMA_MOE_IMAGE_ASSETS.md):
 *   GET /api/v4/circles?circle_id={id}   → { club_rank, circle, members[] }
 *   GET /api/v4/user/profile/{id}        → { trainer, inheritance, support_card, team_stadium[] }
 *
 * NOTE: /api/trainers/{id} returns 404 — that path does not exist on uma.moe.
 *       Use /api/v4/user/profile/{id} for individual trainer data.
 */

export const API_CONFIG = {
  // Base URL includes /api — all endpoint paths below are relative to it.
  // Do NOT include /api in the endpoint paths; that would double the prefix.
  baseUrl:           process.env.UMA_MOE_API_BASE_URL ?? 'https://uma.moe/api',
  apiKey:            process.env.UMA_MOE_API_KEY ?? '',
  timeoutMs:         30_000,
  maxRetries:        3,
  initialBackoffMs:  1_000,
  maxBackoffMs:      60_000,
  backoffMultiplier: 2,
  jitterRange:       0.1, // ±10% random variance
};

/**
 * Approved endpoints only — paths are relative to API_CONFIG.baseUrl.
 * Any endpoint not listed here must not be requested.
 *
 * Primary source: circle endpoint (/api/v4/circles)
 *   Fetch this first. It contains member fan data for the whole circle.
 *   Only call secondary endpoints for fields the circle response does not include.
 *   See docs/miner-data-source.md for the full primary-source strategy.
 */
export const ENDPOINTS = {
  // ── Core data ──────────────────────────────────────────────────────────────
  // Paths are relative to baseUrl (https://uma.moe/api).
  // Full URLs: baseUrl + path, e.g. https://uma.moe/api/v4/circles?circle_id=…
  circle:               '/v4/circles',               // PRIMARY — ?circle_id={id}
  circleList:           '/v4/circles/list',
  circleRankThresholds: '/v4/circles/rank-thresholds',

  // ── Trainer profile (fallback when circle member data is incomplete) ───────
  trainer:        '/v4/user/profile/{id}',     // SECONDARY — was /trainers/{id} (404)
  trainerVeteran: '/v4/user/profile/veterans/{id}',

  // ── Rankings ───────────────────────────────────────────────────────────────
  rankings:        '/rankings',
  rankingsMonthly: '/v4/rankings/monthly',
  rankingsAllTime: '/v4/rankings/alltime',
  rankingsGains:   '/v4/rankings/gains',

  // ── Search ─────────────────────────────────────────────────────────────────
  search: '/v3/search',
  count:  '/v3/count',

  // ── Misc ───────────────────────────────────────────────────────────────────
  stats:          '/stats',
  health:         '/health',
  version:        '/ver',
  versionHistory: '/ver/history',
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
