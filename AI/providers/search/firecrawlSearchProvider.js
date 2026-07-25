// AI/providers/search/firecrawlSearchProvider.js
// Firecrawl Search provider — implements SearchProvider interface.
//
// API: GET https://api.firecrawl.dev/v1/search?q=...&limit=...
// Auth: Bearer <apiKey>
//
// Used as the backup search provider (priority 2) behind Tavily.

import log from '../../../core/log.js';
import config from '../../Configuration.js';

/** @type {import('../interfaces.js').SearchProvider} */
export async function search(query, maxResults = 5) {
  const apiKey = config.firecrawlApiKey;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not set');

  const timeout = config.searchProviderTimeoutMs ?? 8_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `https://api.firecrawl.dev/v1/search?q=${encodeURIComponent(query)}&limit=${Math.min(maxResults, 10)}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (res.status === 429) {
      const err = new Error('Firecrawl Search rate limit (429)');
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Firecrawl Search ${res.status}: ${await res.text()}`);

    const data = await res.json();

    return (data.data ?? []).map((r, i) => ({
      content: r.description ?? r.markdown ?? r.content ?? '',
      url:     r.url      ?? '',
      title:   r.title    ?? '',
      score:   Math.max(1.0 - i * 0.05, 0.1),
      source:  'web',
    }));
  } finally {
    clearTimeout(timer);
  }
}
