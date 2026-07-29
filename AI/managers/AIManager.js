// AI/managers/AIManager.js
// AI Manager — routes LLM requests with provider fallback.
//
// Chain: Mistral AI → Cohere → OpenAI (existing) → Gemini (existing)
// Complexity-aware: simple queries go to faster/cheaper models first.

import log from '../../core/log.js';
import config from '../Configuration.js';
import { getResponse, setResponse, embeddingKey } from '../Cache.js';

// ── Circuit breaker state ────────────────────────────────────────────────
let _circuitOpenUntil = 0;
let _circuitReason = null;
const CIRCUIT_COOLDOWN_MS = 30_000; // 30 sec cooldown after all providers fail

function isCircuitOpen() {
  return _circuitOpenUntil > Date.now();
}

function openCircuit(reason) {
  _circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  _circuitReason = reason;
  log.warn(`[AIManager] Circuit breaker OPEN — cooldown ${CIRCUIT_COOLDOWN_MS / 1000}s reason=${reason}`);
}

function closeCircuit() {
  if (_circuitOpenUntil) {
    _circuitOpenUntil = 0;
    _circuitReason = null;
    log.info('[AIManager] Circuit breaker CLOSED — providers available again');
  }
}

export function circuitBreakerStatus() {
  return { open: isCircuitOpen(), until: _circuitOpenUntil, reason: _circuitReason };
}

// New providers
import { generate as mistralGenerate } from '../providers/ai/mistralProvider.js';
import { generate as cohereGenerate }   from '../providers/ai/cohereProvider.js';

// Existing APIProvider exports OpenAI + Gemini (we call them directly via
// the existing module's generate function which has complexity routing).
import { generate as legacyGenerate } from '../APIProvider.js';

/**
 * Generate a response from the best available LLM.
 * Falls back through the chain on error / rate limit.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @param {'simple'|'complex'} [options.complexity]
 * @returns {Promise<import('../providers/interfaces.js').AIResponse>}
 */
export async function generate(prompt, options = {}) {
  const complexity = options.complexity ?? 'simple';
  const cacheKey = embeddingKey(prompt.slice(0, 500)); // SHA-256 of first 500 chars

  // ── 1. Check response cache ────────────────────────────────────────────
  const cached = getResponse(cacheKey, `ai:${complexity}`);
  if (cached?.text && !options.skipCache) {
    log.info(`[AIManager] Cache hit — returning cached response.`);
    return { text: cached.text, model: cached.model ?? 'cached', tokens: 0 };
  }

  if (isCircuitOpen()) {
    log.warn(`[AIManager] Circuit breaker OPEN — skipping provider calls. reason=${_circuitReason}`);
    const stale = getResponse(cacheKey, `ai:${complexity}`);
    if (stale?.text) {
      return {
        text: `⚠️ AI providers are temporarily unavailable. Here's a cached answer from earlier:\n\n${stale.text}`,
        model: 'cached-stale', tokens: 0,
      };
    }
    throw new Error(`[AIManager] Circuit breaker OPEN — ${_circuitReason}`);
  }
    ? [
        { name: 'Mistral',       fn: () => mistralGenerate(prompt, { model: 'mistral-large-latest', ...options }) },
        { name: 'OpenAI',        fn: () => legacyGenerate(prompt, { ...options, forceProvider: 'openai' }) },
        { name: 'Cohere',        fn: () => cohereGenerate(prompt, options) },
        { name: 'Gemini',        fn: () => legacyGenerate(prompt, { ...options, forceProvider: 'gemini' }) },
      ]
    : [
        { name: 'Mistral',       fn: () => mistralGenerate(prompt, options) },
        { name: 'Cohere',        fn: () => cohereGenerate(prompt, options) },
        { name: 'OpenAI',        fn: () => legacyGenerate(prompt, { ...options, forceProvider: 'openai' }) },
        { name: 'Gemini',        fn: () => legacyGenerate(prompt, { ...options, forceProvider: 'gemini' }) },
      ];

  let allFailed = true;
  for (const { name, fn } of chain) {
    try {
      const result = await fn();
      log.info(`[AIManager] "${name}" returned ${result.tokens} tokens`);
      allFailed = false;
      closeCircuit();
      // ── Cache successful response ─────────────────────────────────────
      setResponse(cacheKey, `ai:${complexity}`, {
        text: result.text, model: result.model, tokens: result.tokens, citations: [],
      });
      return result;
    } catch (err) {
      if (err.isRateLimit) {
        log.warn(`[AIManager] "${name}" rate-limited — next provider`);
      } else if (err.message?.includes('not set')) {
        log.debug(`[AIManager] "${name}" skipped — no API key`);
      } else {
        log.warn(`[AIManager] "${name}" failed: ${err.message}`);
      }
    }
  }

  // ── All providers failed — open circuit breaker ─────────────────────────
  openCircuit(err?.message ?? 'all providers exhausted');

  // ── Try stale cache as last resort ──────────────────────────────────────
  const stale = getResponse(cacheKey, `ai:${complexity}`);
  if (stale?.text) {
    log.warn('[AIManager] All providers exhausted — returning stale cache.');
    return {
      text: `⚠️ AI providers are temporarily unavailable. Here's a cached answer from earlier:\n\n${stale.text}`,
      model: 'cached-stale',
      tokens: 0,
    };
  }

  throw new Error('[AIManager] All AI providers exhausted.');
}
