// AI/managers/AIManager.js
// AI Manager — routes LLM requests with provider fallback.
//
// Chain: Mistral AI → Cohere → OpenAI (existing) → Gemini (existing)
// Complexity-aware: simple queries go to faster/cheaper models first.

import log from '../../core/log.js';
import config from '../Configuration.js';
import { getResponse, setResponse, embeddingKey } from '../Cache.js';

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

  // Simple tier: fast models first
  // Complex tier: powerful models first
  const chain = complexity === 'complex'
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

  for (const { name, fn } of chain) {
    try {
      const result = await fn();
      log.info(`[AIManager] "${name}" returned ${result.tokens} tokens`);
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

  // ── All providers failed — try stale cache as last resort ──────────────
  const stale = getResponse(cacheKey, `ai:${complexity}`);
  if (stale?.text) {
    log.warn('[AIManager] All providers exhausted — returning stale cache.');
    return { text: stale.text, model: stale.model ?? 'cached-stale', tokens: 0 };
  }

  throw new Error('[AIManager] All AI providers exhausted.');
}
