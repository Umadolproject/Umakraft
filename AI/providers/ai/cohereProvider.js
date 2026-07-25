// AI/providers/ai/cohereProvider.js
// Cohere AI provider — implements AIProvider interface (fallback LLM).
//
// API: POST https://api.cohere.ai/v2/chat
// Auth: Bearer <apiKey>
// Model: command-r-plus

import log from '../../../core/log.js';
import config from '../../Configuration.js';

/** @type {import('../interfaces.js').AIProvider} */
export async function generate(prompt, options = {}) {
  const apiKey = config.cohereApiKey;
  if (!apiKey) throw new Error('COHERE_API_KEY not set');

  const model       = options.model       ?? config.cohereModel ?? 'command-r-plus';
  const maxTokens   = options.maxTokens   ?? 1024;
  const temperature = options.temperature ?? 0.7;
  const timeout     = options.timeout     ?? 30_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('https://api.cohere.ai/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        message: prompt,
        preamble: 'You are a helpful AI assistant for the Umakraft Discord bot. Answer concisely about Umamusume Pretty Derby.',
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const err = new Error('Cohere rate limit (429)');
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Cohere ${res.status}: ${await res.text()}`);

    const data = await res.json();

    return {
      text:   data.text ?? data.message?.content?.[0]?.text ?? '',
      model:  model,
      tokens: data.meta?.tokens?.total_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
