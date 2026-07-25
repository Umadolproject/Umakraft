// AI/providers/embeddings/cohereEmbeddingProvider.js
// Cohere embedding provider — implements EmbeddingProvider interface.
//
// API: POST https://api.cohere.ai/v2/embed
// Auth: Bearer <apiKey>
// Model: embed-english-v3.0 (1024-dim) or embed-multilingual-v3.0

import log from '../../../core/log.js';
import config from '../../Configuration.js';

/** @type {import('../interfaces.js').EmbeddingProvider} */
export async function embed(text) {
  const apiKey = config.cohereApiKey;
  if (!apiKey) throw new Error('COHERE_API_KEY not set');

  const model   = config.cohereEmbedModel ?? 'embed-english-v3.0';
  const timeout = config.embeddingTimeoutMs ?? 15_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('https://api.cohere.ai/v2/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        texts: [text.slice(0, 8192)], // Cohere's max input length
        input_type: 'search_document',
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const err = new Error('Cohere Embed rate limit (429)');
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Cohere Embed ${res.status}: ${await res.text()}`);

    const data = await res.json();

    return {
      vector: data.embeddings?.[0] ?? [],
      model:  data.model ?? model,
      tokens: data.meta?.tokens?.total_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
