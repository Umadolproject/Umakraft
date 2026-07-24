// AI/APIProvider.js
// Abstract AI provider interface for the Umakraft AI Knowledge Service.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/API_PROVIDER.md
//
// Responsibilities:
//   - generate(prompt, options) — complexity-routed chat completion
//   - embed(text)               — embedding vector generation
//   - Linear-backoff retry via core/errors.js withRetry()
//   - Bidirectional fallback between simple (Gemini) and complex (GPT-4o-mini) tiers
//   - Sliding-window rate limiter (per-minute, guild-wide)
//   - Never expose API keys outside this module

import { withRetry } from '../core/errors.js';
import log from '../core/log.js';
import config, { requireApiKey } from './Configuration.js';
import { getEmbedding, setEmbedding } from './Cache.js';

// ---------------------------------------------------------------------------
// Rate Limiter — sliding window
// ---------------------------------------------------------------------------

/** @type {number[]} timestamps of recent requests (ms) */
const _requestTimestamps = [];

/**
 * Check and record a new request against the guild-level rate limit.
 * Throws a rate-limit error if the per-minute cap is exceeded.
 *
 * @param {number} limitRpm
 */
function checkRateLimit(limitRpm = config.rateLimitRpm) {
  const now = Date.now();
  const windowStart = now - 60_000; // 1-minute sliding window

  // Drop timestamps outside the window
  while (_requestTimestamps.length > 0 && _requestTimestamps[0] < windowStart) {
    _requestTimestamps.shift();
  }

  if (_requestTimestamps.length >= limitRpm) {
    const retryAfterMs = _requestTimestamps[0] - windowStart;
    throw Object.assign(
      new Error(`[AI/APIProvider] Rate limit exceeded (${limitRpm} RPM). Retry after ${Math.ceil(retryAfterMs / 1000)}s.`),
      { code: 'RATE_LIMITED', retryAfterMs }
    );
  }

  _requestTimestamps.push(now);
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Key pool helpers
// ---------------------------------------------------------------------------

/** Returns all configured OpenAI keys (primary first, backup second). */
function openaiKeys() {
  return [config.openaiApiKey, config.openaiApiKey2].filter(Boolean);
}

/** Returns all configured Gemini keys (primary first, backup second). */
function geminiKeys() {
  return [config.geminiApiKey, config.geminiApiKey2].filter(Boolean);
}

/**
 * Try fn(keys[0]); if it throws a rate-limit error (HTTP 429) and a
 * second key exists, log a warning and retry with fn(keys[1]).
 *
 * @template T
 * @param {string}   label  — logging label
 * @param {string[]} keys   — ordered key pool
 * @param {(key: string) => Promise<T>} fn
 * @returns {Promise<T>}
 */
async function withKeyRotation(label, keys, fn) {
  if (keys.length === 0) {
    throw new Error(`[AI/APIProvider] No API key configured for ${label}.`);
  }
  try {
    return await fn(keys[0]);
  } catch (err) {
    if (err.isRateLimit && keys.length > 1) {
      log.warn(
        `[AI/APIProvider] ${label} primary key rate-limited (429) — ` +
        `rotating to backup key.`
      );
      return await fn(keys[1]);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

/**
 * Call OpenAI chat completions API (used for complex tier: gpt-4o-mini).
 *
 * @param {string} prompt
 * @param {string} model
 * @param {number} maxTokens
 * @param {number} temperature
 * @param {string} apiKey
 * @returns {Promise<{ text: string, model: string, tokens: number }>}
 */
async function callOpenAI(prompt, model, maxTokens, temperature, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens:  maxTokens,
      temperature,
    }),
  });

  if (response.status === 429) {
    const body = await response.text();
    const err = new Error(`[AI/APIProvider] OpenAI 429 rate limit: ${body}`);
    err.isRateLimit = true;
    throw err;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[AI/APIProvider] OpenAI ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text   = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.total_tokens ?? 0;

  return { text, model, tokens };
}

/**
 * Call Google Gemini generateContent API (used for simple tier: gemini-1.5-flash).
 *
 * @param {string} prompt
 * @param {string} model
 * @param {number} maxTokens
 * @param {number} temperature
 * @param {string} apiKey
 * @returns {Promise<{ text: string, model: string, tokens: number }>}
 */
async function callGemini(prompt, model, maxTokens, temperature, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent` +
    `?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  });

  // Gemini returns 429 for quota exceeded and 503 for resource exhausted
  if (response.status === 429 || response.status === 503) {
    const body = await response.text();
    const err = new Error(`[AI/APIProvider] Gemini ${response.status} rate limit: ${body}`);
    err.isRateLimit = true;
    throw err;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[AI/APIProvider] Gemini ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text   = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const tokens =
    (data.usageMetadata?.promptTokenCount ?? 0) +
    (data.usageMetadata?.candidatesTokenCount ?? 0);

  return { text, model, tokens };
}

/**
 * Call OpenAI Embeddings API to produce a float32 vector.
 *
 * @param {string} text
 * @param {string} apiKey
 * @returns {Promise<number[]>}
 */
async function callOpenAIEmbed(text, apiKey) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: config.embeddingModel,
      input: text,
    }),
  });

  if (response.status === 429) {
    const body = await response.text();
    const err = new Error(`[AI/APIProvider] OpenAI Embeddings 429 rate limit: ${body}`);
    err.isRateLimit = true;
    // insufficient_quota is a billing error — retrying will never help.
    if (body.includes('insufficient_quota')) err.isQuotaExhausted = true;
    throw err;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[AI/APIProvider] OpenAI Embeddings ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding ?? [];
}

// ---------------------------------------------------------------------------
// Model tier helpers
// ---------------------------------------------------------------------------

/** @returns {'openai'|'gemini'} */
function providerForComplexity(complexity) {
  return complexity === 'simple' ? 'gemini' : 'openai';
}

/** @returns {string} model name */
function modelForComplexity(complexity) {
  return complexity === 'simple' ? config.simpleModel : config.complexModel;
}

/** @returns {'simple'|'complex'} */
function oppositeComplexity(complexity) {
  return complexity === 'simple' ? 'complex' : 'simple';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a chat completion.
 *
 * Selects the model based on the `complexity` field set by the Topic Filter:
 *   - 'simple'  → Gemini 1.5 Flash (free tier, fast factual lookups)
 *   - 'complex' → GPT-4o-mini (strong reasoning, cost-effective)
 *
 * Retries up to AI_MAX_RETRIES times with linear backoff.
 * If the primary tier exhausts its retries, falls back to the other tier.
 * If the fallback also fails, throws a graceful error.
 *
 * @param {string} prompt — fully assembled prompt (use AI/Security.buildSafePrompt)
 * @param {{
 *   complexity?: 'simple' | 'complex',
 *   model?:      string,
 *   maxTokens?:  number,
 *   temperature?: number,
 * }} [options]
 * @returns {Promise<{ text: string, model: string, tokens: number }>}
 */
export async function generate(prompt, options = {}) {
  const {
    complexity  = 'complex',
    model:       explicitModel,
    maxTokens   = 1024,
    temperature = 0.3,
  } = options;

  checkRateLimit();

  // Explicit model override — bypass complexity routing
  if (explicitModel) {
    const isGemini = explicitModel.startsWith('gemini');
    const keys     = isGemini ? geminiKeys() : openaiKeys();
    const caller   = isGemini ? callGemini   : callOpenAI;
    return withRetry(
      () => withKeyRotation(explicitModel, keys, key => caller(prompt, explicitModel, maxTokens, temperature, key)),
      { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: `generate[${explicitModel}]` }
    );
  }

  // Complexity-tier routing with fallback
  const primaryComplexity  = complexity;
  const fallbackComplexity = oppositeComplexity(complexity);

  const primaryModel   = modelForComplexity(primaryComplexity);
  const fallbackModel  = modelForComplexity(fallbackComplexity);
  const primaryProvider  = providerForComplexity(primaryComplexity);
  const fallbackProvider = providerForComplexity(fallbackComplexity);

  const primaryCaller  = primaryProvider  === 'gemini' ? callGemini : callOpenAI;
  const fallbackCaller = fallbackProvider === 'gemini' ? callGemini : callOpenAI;
  const primaryKeys    = primaryProvider  === 'gemini' ? geminiKeys() : openaiKeys();
  const fallbackKeys   = fallbackProvider === 'gemini' ? geminiKeys() : openaiKeys();

  try {
    const result = await withRetry(
      () => withKeyRotation(primaryModel, primaryKeys, key => primaryCaller(prompt, primaryModel, maxTokens, temperature, key)),
      { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: `generate[${primaryModel}]` }
    );
    log.info(`[AI/APIProvider] Served by primary: ${primaryModel}`);
    return result;
  } catch (primaryErr) {
    log.warn(
      `[AI/APIProvider] ${primaryModel} failed after ${config.maxRetries} attempts — ` +
      `falling back to ${fallbackModel}. Error: ${primaryErr.message}`
    );

    try {
      const result = await withRetry(
        () => withKeyRotation(fallbackModel, fallbackKeys, key => fallbackCaller(prompt, fallbackModel, maxTokens, temperature, key)),
        { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: `generate-fallback[${fallbackModel}]` }
      );
      log.info(`[AI/APIProvider] Served by fallback: ${fallbackModel}`);
      return result;
    } catch (fallbackErr) {
      log.error(
        `[AI/APIProvider] Both model tiers failed. ` +
        `Primary (${primaryModel}): ${primaryErr.message} | ` +
        `Fallback (${fallbackModel}): ${fallbackErr.message}`
      );
      throw new Error(
        'The AI Knowledge Service is temporarily unavailable. ' +
        'Both model tiers failed to respond. Please try again shortly.'
      );
    }
  }
}

/**
 * Generate an embedding vector for the given text.
 *
 * Checks the embedding cache first. On miss, calls OpenAI Embeddings API
 * and stores the result in cache before returning.
 *
 * The embedding model must match between index time and query time.
 * Current model: AI_EMBEDDING_MODEL (default: text-embedding-3-small, dim: 1536).
 *
 * @param {string} text
 * @returns {Promise<number[]>}
 */
export async function embed(text) {
  const normalised = text.toLowerCase().trim();

  // Cache check
  const cached = getEmbedding(normalised);
  if (cached !== undefined) {
    log.debug(`[AI/APIProvider] Embedding cache hit for "${normalised.slice(0, 40)}..."`);
    return cached;
  }

  // Generate via OpenAI — rotate to backup key on 429
  const vector = await withRetry(
    () => withKeyRotation('embed', openaiKeys(), key => callOpenAIEmbed(normalised, key)),
    { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: 'embed' }
  );

  setEmbedding(normalised, vector);
  log.debug(`[AI/APIProvider] Embedding generated and cached (dim: ${vector.length})`);
  return vector;
}

/**
 * Expose the current rate limiter state for health reporting.
 * @returns {{ requestsInLastMinute: number, limitRpm: number }}
 */
export function rateLimiterStats() {
  const now = Date.now();
  const windowStart = now - 60_000;
  const recent = _requestTimestamps.filter(t => t >= windowStart).length;
  return { requestsInLastMinute: recent, limitRpm: config.rateLimitRpm };
}
