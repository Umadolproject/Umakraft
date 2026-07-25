// AI/providers/ai/mistralProvider.js
// Mistral AI provider — implements AIProvider interface.
//
// API: POST https://api.mistral.ai/v1/chat/completions
// Auth: Bearer <apiKey>
// Models: mistral-large-latest, mistral-small-latest, open-mistral-nemo

import log from '../../../core/log.js';
import config from '../../Configuration.js';

/** @type {import('../interfaces.js').AIProvider} */
export async function generate(prompt, options = {}) {
  const apiKey = config.mistralApiKey;
  if (!apiKey) throw new Error('MISTRAL_API_KEY not set');

  const model       = options.model       ?? config.mistralModel ?? 'mistral-small-latest';
  const maxTokens   = options.maxTokens   ?? 1024;
  const temperature = options.temperature ?? 0.7;
  const timeout     = options.timeout     ?? 30_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a helpful AI assistant for the Umakraft Discord bot. Answer concisely and accurately about Umamusume Pretty Derby, the uma.moe website, and the Umakraft codebase.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const err = new Error('Mistral rate limit (429)');
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Mistral ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const choice = data.choices?.[0];

    return {
      text:   choice?.message?.content ?? '',
      model:  data.model ?? model,
      tokens: data.usage?.total_tokens ?? 0,
    };
  } finally {
    clearTimeout(timer);
  }
}
