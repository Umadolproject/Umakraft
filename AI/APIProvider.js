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
//   - Mistral-primary generation with local-model fallback
//   - Sliding-window rate limiter (per-minute, guild-wide)
//   - Never expose API keys outside this module

import { withRetry } from '../core/errors.js';
import log from '../core/log.js';
import config, { requireApiKey } from './Configuration.js';
import { getEmbedding, setEmbedding } from './Cache.js';
import { generate as generateLocal } from './model.js';
import { embed as embedLocal } from './providers/embeddings/localEmbeddingProvider.js';
import { embed as embedCohere } from './providers/embeddings/cohereEmbeddingProvider.js';

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

/** Returns all configured Mistral keys. */
function mistralKeys() {
  return [config.mistralApiKey].filter(Boolean);
}

/** Returns all configured Groq keys. */
function groqKeys() {
  return [config.groqApiKey].filter(Boolean);
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
 * Call Mistral chat completions API.
 *
 * @param {string} prompt
 * @param {string} model
 * @param {number} maxTokens
 * @param {number} temperature
 * @param {string} apiKey
 * @returns {Promise<{ text: string, model: string, tokens: number }>}
 */
async function callMistral(prompt, model, maxTokens, temperature, apiKey) {
  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
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
    const err = new Error(`[AI/APIProvider] Mistral 429 rate limit: ${body}`);
    err.isRateLimit = true;
    throw err;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[AI/APIProvider] Mistral ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text   = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.total_tokens ?? 0;

  return { text, model, tokens };
}

/**
 * Call Groq chat completions API (OpenAI-compatible, LPU-accelerated).
 *
 * @param {string} prompt
 * @param {string} model
 * @param {number} maxTokens
 * @param {number} temperature
 * @param {string} apiKey
 * @returns {Promise<{ text: string, model: string, tokens: number }>}
 */
async function callGroq(prompt, model, maxTokens, temperature, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
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
    const err = new Error(`[AI/APIProvider] Groq 429 rate limit: ${body}`);
    err.isRateLimit = true;
    throw err;
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`[AI/APIProvider] Groq ${response.status}: ${body}`);
  }

  const data = await response.json();
  const text   = data.choices?.[0]?.message?.content ?? '';
  const tokens = data.usage?.total_tokens ?? 0;

  return { text, model, tokens };
}

/**
 * Call local HuggingFace model.
 *
 * @param {string} prompt
 * @param {string} model
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Promise<{ text: string, model: string, tokens: number }>}
 */
async function callLocal(prompt, model, maxTokens, temperature) {
  const result = await generateLocal(
    [{ role: 'user', content: prompt }],
    { maxNewTokens: maxTokens, temperature }
  );
  return { text: result.text, model, tokens: 0 };
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
 * Routes to Mistral as primary provider with Groq as fast fallback.
 * Falls back to the local HuggingFace model (SmolLM2-135M-Instruct)
 * if both cloud providers fail.
 *
 * Retries each provider up to AI_MAX_RETRIES times with linear backoff.
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
    model:       explicitModel,
    maxTokens   = 1024,
    temperature = 0.3,
  } = options;

  checkRateLimit();

  const primaryModel = explicitModel || config.mistralModel;
  const mistralKeysList = mistralKeys();

  // Explicit model override
  if (explicitModel) {
    const isLocal = explicitModel === 'local' || explicitModel.startsWith('local:');
    if (isLocal) {
      log.info(`[AI/APIProvider] Explicit local model: ${explicitModel}`);
      return callLocal(prompt, explicitModel, maxTokens, temperature);
    }
    // Default to Mistral for any other explicit model
    if (mistralKeysList.length === 0) {
      throw new Error('[AI/APIProvider] No MISTRAL_API_KEY configured.');
    }
    return withRetry(
      () => withKeyRotation(primaryModel, mistralKeysList, key => callMistral(prompt, primaryModel, maxTokens, temperature, key)),
      { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: `generate[${primaryModel}]` }
    );
  }

  // ── Primary: Mistral ────────────────────────────────────────────────
  if (mistralKeysList.length === 0) {
    log.warn('[AI/APIProvider] No MISTRAL_API_KEY set — skipping to Groq fallback.');
  } else {
    try {
      const result = await withRetry(
        () => withKeyRotation(primaryModel, mistralKeysList, key => callMistral(prompt, primaryModel, maxTokens, temperature, key)),
        { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: `generate[${primaryModel}]` }
      );
      log.info(`[AI/APIProvider] Served by Mistral: ${primaryModel}`);
      return result;
    } catch (mistralErr) {
      log.warn(
        `[AI/APIProvider] Mistral (${primaryModel}) failed after ${config.maxRetries} attempts — ` +
        `falling back to Groq. Error: ${mistralErr.message}`
      );
    }
  }

  // ── Fallback 1: Groq (LPU-accelerated) ──────────────────────────────
  const groqModel = config.groqModel;
  const groqKeysList = groqKeys();
  if (groqKeysList.length === 0) {
    log.warn('[AI/APIProvider] No GROQ_API_KEY set — skipping to local fallback.');
  } else {
    try {
      const result = await withRetry(
        () => withKeyRotation(groqModel, groqKeysList, key => callGroq(prompt, groqModel, maxTokens, temperature, key)),
        { maxAttempts: config.maxRetries, delayMs: config.retryBaseDelayMs, context: `generate[${groqModel}]` }
      );
      log.info(`[AI/APIProvider] Served by Groq (fallback): ${groqModel}`);
      return result;
    } catch (groqErr) {
      log.warn(
        `[AI/APIProvider] Groq (${groqModel}) failed after ${config.maxRetries} attempts — ` +
        `falling back to local model. Error: ${groqErr.message}`
      );
    }
  }

  // ── Fallback: Local model ───────────────────────────────────────────
  try {
    const localModelId = config.localModelId;
    log.info(`[AI/APIProvider] Falling back to local model: ${localModelId}`);
    const result = await callLocal(prompt, localModelId, maxTokens, temperature);
    log.info(`[AI/APIProvider] Served by fallback (local): ${localModelId}`);
    return result;
  } catch (localErr) {
    log.error(
      `[AI/APIProvider] All providers (Mistral, Groq, local) failed. ` +
      `Local: ${localErr.message}`
    );
    throw new Error(
      'The AI Knowledge Service is temporarily unavailable. ' +
      'All providers (Mistral, Groq, local) are currently unavailable. ' +
      { cause: localErr }
    );
  }
}

/**
 * Generate an embedding vector for the given text.
 *
 * Checks the embedding cache first. On miss, tries local embedding
 * (Xenova/all-MiniLM-L6-v2, 384-dim) first, then falls back to Cohere
 * (embed-english-v3.0, 1024-dim). OpenAI has been removed.
 *
 * Caches the result before returning.
 *
 * @param {string} text
 * @returns {Promise<{ vector: number[], model: string, tokens: number }>}
 */
export async function embed(text) {
  const normalised = text.toLowerCase().trim();

  // Cache check
  const cached = getEmbedding(normalised);
  if (cached !== undefined) {
    log.debug(`[AI/APIProvider] Embedding cache hit for "${normalised.slice(0, 40)}..."`);
    return { vector: cached, model: 'cached', tokens: 0 };
  }

  // ── Primary: Local embedding (Xenova/all-MiniLM-L6-v2, 384-dim) ───
  try {
    const result = await embedLocal(normalised);
    setEmbedding(normalised, result.vector);
    log.debug(`[AI/APIProvider] Embedding served by local: ${result.model} (dim: ${result.vector.length})`);
    return { vector: result.vector, model: result.model, tokens: result.tokens ?? 0 };
  } catch (localErr) {
    log.warn(`[AI/APIProvider] Local embedding failed — falling back to Cohere. Error: ${localErr.message}`);
  }

  // ── Fallback: Cohere (embed-english-v3.0, 1024-dim) ──────────────
  try {
    const cohereResult = await embedCohere(normalised);
    setEmbedding(normalised, cohereResult.vector);
    log.info(`[AI/APIProvider] Embedding served by Cohere: ${cohereResult.model} (dim: ${cohereResult.vector.length})`);
    return { vector: cohereResult.vector, model: cohereResult.model, tokens: cohereResult.tokens ?? 0 };
  } catch (cohereErr) {
    log.error(`[AI/APIProvider] Cohere embedding also failed: ${cohereErr.message}`);
    throw new Error(
      'Embedding service is temporarily unavailable. ' +
      'Both local and Cohere embedding providers failed.',
      { cause: cohereErr }
    );
  }
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
