// AI/managers/EmbeddingManager.js
// Embedding Manager — generates vector embeddings with provider fallback.
//
// Primary: Cohere Embed (new).  Fallback: OpenAI (existing APIProvider.embed).

import log from '../../core/log.js';
import { embed as cohereEmbed } from '../providers/embeddings/cohereEmbeddingProvider.js';
import { embed as legacyEmbed } from '../APIProvider.js';

/** @type {Array<{ name: string, fn: () => Promise<import('../providers/interfaces.js').EmbeddingVector> }>} */
const chain = [
  { name: 'Cohere', fn: cohereEmbed },
  { name: 'OpenAI', fn: legacyEmbed },
];

/**
 * Generate an embedding vector for the given text.
 *
 * @param {string} text
 * @returns {Promise<import('../providers/interfaces.js').EmbeddingVector>}
 */
export async function embed(text) {
  if (!text?.trim()) throw new Error('[EmbeddingManager] Text is required');

  for (const { name, fn } of chain) {
    try {
      const result = await fn(text);
      if (result.vector?.length > 0) return result;
      log.warn(`[EmbeddingManager] "${name}" returned empty vector`);
    } catch (err) {
      if (err.message?.includes('not set')) {
        log.debug(`[EmbeddingManager] "${name}" skipped — no API key`);
      } else {
        log.warn(`[EmbeddingManager] "${name}" failed: ${err.message}`);
      }
    }
  }

  throw new Error('[EmbeddingManager] All embedding providers exhausted.');
}
