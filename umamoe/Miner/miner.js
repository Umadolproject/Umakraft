/**
 * Miner
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Miner — Stage 1, Umamoe
 *
 * Sole responsibility: acquire raw data from approved uma.moe API endpoints.
 * Passes result to Courier. Never validates, transforms, or stores data.
 *
 * Data source priority (see docs/miner-data-source.md):
 *   1. Circle endpoint (/api/v4/circles?circle_id=…)  — PRIMARY
 *   2. Trainer profile (/api/v4/user/profile/{id})    — FALLBACK for missing fields
 *
 * Auth: X-API-Key header — set UMA_MOE_API_KEY in Railway Variables / Replit Secrets.
 */

import { API_CONFIG, ENDPOINTS, STATUS_RETRIABLE } from './config.js';

// ─── Logging ────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'miner',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Backoff ─────────────────────────────────────────────────────────────────

function computeBackoff(attempt) {
  const base  = API_CONFIG.initialBackoffMs * Math.pow(API_CONFIG.backoffMultiplier, attempt);
  const capped = Math.min(base, API_CONFIG.maxBackoffMs);
  const jitter = capped * API_CONFIG.jitterRange * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
}

function sleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildUrl(path) {
  return `${API_CONFIG.baseUrl}${path}`;
}

// ─── Failure envelope ────────────────────────────────────────────────────────

function failure(error, message, severity, retriable, context = {}) {
  return {
    success: false, error, message, severity, retriable,
    timestamp: new Date().toISOString(), context,
  };
}

// ─── Core fetch with timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

  const headers = { ...(options.headers ?? {}) };
  if (API_CONFIG.apiKey) {
    // uma.moe is case-sensitive: the server rejects 'X-API-Key' with 403.
    // Must be lowercase 'x-api-key'.
    headers['x-api-key'] = API_CONFIG.apiKey;
  } else {
    log('warn', 'UMA_MOE_API_KEY is not set — requests will be unauthenticated', { url });
  }

  try {
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Request with retry ───────────────────────────────────────────────────────

async function requestWithRetry(url, endpoint) {
  let attempt = 0;

  while (attempt <= API_CONFIG.maxRetries) {
    log('info', `request attempt ${attempt + 1}/${API_CONFIG.maxRetries + 1}`, { endpoint, url });

    let response;
    try {
      response = await fetchWithTimeout(url);
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      const error = isTimeout ? 'API_TIMEOUT' : 'API_NETWORK_ERROR';
      const message = isTimeout
        ? `Request timed out after ${API_CONFIG.timeoutMs}ms`
        : `Network error: ${err.message}`;

      if (attempt < API_CONFIG.maxRetries) {
        const delay = computeBackoff(attempt);
        log('warn', `${error} — retrying in ${delay}ms`, { endpoint, attempt });
        await sleep(delay);
        attempt++;
        continue;
      }
      return failure(error, message, 'error', true, { endpoint, attempts: attempt + 1 });
    }

    const status = response.status;

    // Rate limited — respect Retry-After header
    if (status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      log('warn', `API_RATE_LIMIT_EXCEEDED — waiting ${retryAfter}s`, { endpoint, attempt });
      if (attempt < API_CONFIG.maxRetries) {
        await sleep(retryAfter * 1000);
        attempt++;
        continue;
      }
      return failure('API_RATE_LIMIT_EXCEEDED', 'Rate limit exceeded after max retries', 'warning', true, {
        endpoint, statusCode: status, attempts: attempt + 1, retryAfter,
      });
    }

    // Permanent failures — do not retry
    if (STATUS_RETRIABLE[status] === false) {
      const message = `Permanent API error — HTTP ${status}`;
      log('error', message, { endpoint, statusCode: status });
      return failure('API_PERMANENT_ERROR', message, 'error', false, {
        endpoint, statusCode: status, attempts: attempt + 1,
      });
    }

    // Transient server errors — retry
    if (STATUS_RETRIABLE[status] === true) {
      if (attempt < API_CONFIG.maxRetries) {
        const delay = computeBackoff(attempt);
        log('warn', `Transient error HTTP ${status} — retrying in ${delay}ms`, { endpoint, attempt });
        await sleep(delay);
        attempt++;
        continue;
      }
      return failure('API_SERVER_ERROR', `Server error HTTP ${status} after max retries`, 'error', true, {
        endpoint, statusCode: status, attempts: attempt + 1,
      });
    }

    // Success
    if (status === 200) {
      let data;
      try {
        data = await response.json();
      } catch {
        return failure('API_INVALID_JSON', 'API returned non-JSON response', 'error', false, {
          endpoint, statusCode: status, attempts: attempt + 1,
        });
      }

      log('info', 'request succeeded', { endpoint, statusCode: status });
      return {
        success: true,
        data,
        metadata: {
          endpoint,
          statusCode: status,
          timestamp:  new Date().toISOString(),
          source:     'uma.moe',
          attempts:   attempt + 1,
        },
      };
    }

    // Unexpected status
    return failure('API_UNEXPECTED_STATUS', `Unexpected HTTP status ${status}`, 'error', false, {
      endpoint, statusCode: status, attempts: attempt + 1,
    });
  }
}

// ─── Profile response normaliser ─────────────────────────────────────────────
//
// The /api/v4/user/profile/{id} endpoint returns a nested object:
//   { trainer: { account_id, name, team_class, rank_score, ... },
//     inheritance: { ... }, support_card: { ... }, team_stadium: [...] }
//
// The Inspector and downstream pipeline expect a flat trainer object with at
// minimum: id (string), name (string), fans (number ≥ 0), rank (number 1–N).
//
// fans is NOT present in the profile response — it lives in the circle
// endpoint's daily_fans array.  We set it to 0 here so the object passes
// Inspector validation; pipeline.js will override it with real circle data
// via mergeCircleMemberGains before the Inspector ever runs.

function normalizeProfileResponse(data) {
  if (!data || typeof data !== 'object') return data;

  // Already flat (unit-test mocks, legacy callers) — return as-is.
  if (typeof data.id === 'string' && typeof data.name === 'string') return data;

  const trainer = data.trainer ?? {};

  return {
    // Required by Inspector ──────────────────────────────────────────────────
    id:   String(trainer.account_id ?? trainer.viewer_id ?? trainer.id ?? ''),
    name: String(trainer.name ?? trainer.trainer_name ?? ''),
    fans: typeof trainer.fans === 'number' ? trainer.fans : 0,
    // team_class is the stadium rank tier (1–9); rank_score is the numeric
    // score.  We prefer team_class as the primary rank signal because it maps
    // 1-to-1 onto the circle tier shown in the UI.
    rank: trainer.team_class ?? trainer.rank ?? 1,

    // Extended profile fields ─────────────────────────────────────────────────
    team_class:             trainer.team_class,
    rank_score:             trainer.rank_score,
    team_evaluation_point:  trainer.team_evaluation_point,
    follower_num:           trainer.follower_num,
    leader_chara_dress_id:  trainer.leader_chara_dress_id,
    trophy_num_info:        trainer.trophy_num_info,
    release_num_info:       trainer.release_num_info,

    // Preserve raw nested payload for Workshop/Fabricator profile rendering
    _profile: data,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single trainer profile by ID.
 *
 * Uses /api/v4/user/profile/{id} — the correct uma.moe trainer endpoint.
 * The raw nested response is normalised to a flat object before returning.
 *
 * NOTE: The profile endpoint does NOT include fan count (daily_fans).
 * Fan data comes from fetchCircle(). pipeline.js merges both sources so
 * the Inspector always receives a fully-populated trainer object.
 *
 * @param {string} trainerId
 * @returns {Promise<MinerEnvelope>}
 */
export async function fetchTrainer(trainerId) {
  if (!trainerId) {
    return failure('MINER_INVALID_PARAMS', 'trainerId is required', 'error', false, { trainerId });
  }

  const path     = ENDPOINTS.trainer.replace('{id}', encodeURIComponent(trainerId));
  const url      = buildUrl(path);
  const result   = await requestWithRetry(url, path);

  if (!result.success) return result;
  return { ...result, data: normalizeProfileResponse(result.data) };
}

/**
 * Fetch circle data by circle ID — PRIMARY data source.
 *
 * Preferred over fetchTrainer for bulk member data.
 * Returns { club_rank, circle: {...}, members: [{viewer_id, trainer_name, daily_fans, ...}] }.
 * Call this first; only call fetchTrainer for fields not present in the circle response.
 *
 * @param {string|number} circleId
 * @returns {Promise<MinerEnvelope>}
 */
export async function fetchCircle(circleId) {
  if (!circleId) {
    return failure('MINER_INVALID_PARAMS', 'circleId is required', 'error', false, { circleId });
  }

  const url = new URL(buildUrl(ENDPOINTS.circle));
  url.searchParams.set('circle_id', circleId);
  return requestWithRetry(url.toString(), ENDPOINTS.circle);
}

/**
 * Search trainers by query parameters.
 * @param {object} params — e.g. { q: 'alice', limit: 20 }
 * @returns {Promise<MinerEnvelope>}
 */
export async function searchTrainers(params = {}) {
  const url = new URL(buildUrl(ENDPOINTS.search));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return requestWithRetry(url.toString(), ENDPOINTS.search);
}

/**
 * Fetch ranked trainers.
 * @param {object} params — e.g. { limit: 50, page: 1 }
 * @returns {Promise<MinerEnvelope>}
 */
export async function fetchRankings(params = {}) {
  const url = new URL(buildUrl(ENDPOINTS.rankings));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return requestWithRetry(url.toString(), ENDPOINTS.rankings);
}

/**
 * Fetch service statistics.
 * @returns {Promise<MinerEnvelope>}
 */
export async function fetchStats() {
  return requestWithRetry(buildUrl(ENDPOINTS.stats), ENDPOINTS.stats);
}

/**
 * Health check.
 * @returns {Promise<MinerEnvelope>}
 */
export async function checkHealth() {
  return requestWithRetry(buildUrl(ENDPOINTS.health), ENDPOINTS.health);
}
