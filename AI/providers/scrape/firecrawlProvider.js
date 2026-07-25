// AI/providers/scrape/firecrawlProvider.js
// Firecrawl Scrape provider — implements ScrapeProvider interface.
//
// API: POST https://api.firecrawl.dev/v1/scrape
// Auth: Bearer <apiKey>
//
// Extracts page content as clean markdown.

import log from '../../../core/log.js';
import config from '../../Configuration.js';

/** @type {import('../interfaces.js').ScrapeProvider} */
export async function scrape(url) {
  const apiKey = config.firecrawlApiKey;
  if (!apiKey) throw new Error('FIRECRAWL_API_KEY not set');

  const timeout = config.scrapeTimeoutMs ?? 20_000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: ['markdown'],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      const err = new Error('Firecrawl Scrape rate limit (429)');
      err.isRateLimit = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Firecrawl Scrape ${res.status}: ${await res.text()}`);

    const data = await res.json();

    return {
      url:      url,
      markdown: data.data?.markdown ?? '',
      title:    data.data?.metadata?.title ?? '',
      metadata: data.data?.metadata ?? {},
    };
  } finally {
    clearTimeout(timer);
  }
}
