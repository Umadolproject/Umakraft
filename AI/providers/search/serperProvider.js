// AI/providers/search/serperProvider.js
// Serper.dev Google Search provider — implements SearchProvider interface.
//
// API: POST https://google.serper.dev/search
// Auth: X-API-KEY header
//
// Serper is a lightweight Google Search API.  Faster & cheaper than Tavily,
// better for documentation/code lookups.  Excellent fallback when Tavily
// and Brave don't return domain-specific results.

import log from '../../../core/log.js';
import config from '../../Configuration.js';

/** @type {import('../interfaces.js').SearchProvider} */
export async function search(query, maxResults = 5) {
  const apiKey = config.serperApiKey;
  if (!apiKey) throw new Error('SERPER_API_KEY not set');

  const timeout = config.searchProviderTimeoutMs ?? 8_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        q: query,
        num: Math.min(maxResults, 10),
        gl: 'us', // country code
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const err = new Error('Serper rate limit (429)');
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Serper ${res.status}: ${await res.text()}`);

    const data = await res.json();

    // Serper returns organic + knowledgeGraph + answerBox results
    const organic = data.organic ?? [];
    const knowledgeGraph = data.knowledgeGraph
      ? [{ title: data.knowledgeGraph.title, snippet: data.knowledgeGraph.description, link: data.knowledgeGraph.link }]
      : [];

    return [...knowledgeGraph, ...organic].slice(0, maxResults).map((r, i) => ({
      content: r.snippet ?? r.description ?? '',
      url:     r.link    ?? '',
      title:   r.title   ?? '',
      score:   Math.max(1.0 - i * 0.05, 0.1),
      source:  'web',
    }));
  } finally {
    clearTimeout(timer);
  }
}
