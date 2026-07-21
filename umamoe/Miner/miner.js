/**
 * Miner
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Miner — Stage 1, Umamoe
 *
 * Sole responsibility: acquire raw data from approved uma.moe API endpoints.
 * Passes result to Courier. Never validates, transforms, or stores data.
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
  const base = API_CONFIG.initialBackoffMs * Math.pow(API_CONFIG.backoffMultiplier, attempt);
  const capped = Math.min(base, API_CONFIG.maxBackoffMs);
  const jitter = capped * API_CONFIG.jitterRange * (Math.random() * 2 - 1);
  return Math.round(capped + jitter);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── URL builder ─────────────────────────────────────────────────────────────

function buildUrl(path, params = {}) {
  let resolved = path;
  for (const [key, value] of Object.entries(params)) {
    resolved = resolved.replace(`{${key}}`, encodeURIComponent(value));
  }
  return `${API_CONFIG.baseUrl}${resolved}`;
}

// ─── Failure envelope ────────────────────────────────────────────────────────

function failure(error, message, severity, retriable, context = {}) {
  return { success: false, error, message, severity, retriable, timestamp: new Date().toISOString(), context };
}

// ─── Core fetch with timeout ─────────────────────────────────────────────────

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
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
          timestamp: new Date().toISOString(),
          source: 'uma.moe',
          attempts: attempt + 1,
        },
      };
    }

    // Unexpected status
    return failure('API_UNEXPECTED_STATUS', `Unexpected HTTP status ${status}`, 'error', false, {
      endpoint, statusCode: status, attempts: attempt + 1,
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch a single trainer profile by ID.
 * @param {string} trainerId
 * @returns {Promise<MinerEnvelope>}
 */
export async function fetchTrainer(trainerId) {
  if (!trainerId) {
    return failure('MINER_INVALID_PARAMS', 'trainerId is required', 'error', false, { trainerId });
  }
  const endpoint = ENDPOINTS.trainer.replace('{id}', trainerId);
  const url = buildUrl(endpoint);
  return requestWithRetry(url, endpoint);
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
