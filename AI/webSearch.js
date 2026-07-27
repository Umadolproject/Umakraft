// AI/webSearch.js
// Web search fallback — used when local document search returns no results.
// Tries configured search APIs in priority order:
//   1. Tavily (best for AI context)
//   2. Brave Search
//   3. SerpAPI (Google)
//   4. Serper (Google via Serper.dev)
// Results are formatted to look like document search results so the AI
// prompt builder and answer pipeline can consume them transparently.

import config from './Configuration.js';
import log from '../core/log.js';

const SEARCH_CACHE = new Map();
const CACHE_TTL = config.searchCacheTtlMs || 600_000; // 10 min default

function cacheKey(query) {
  return `web:${query.toLowerCase().trim().slice(0, 120)}`;
}

function cacheGet(query) {
  const key = cacheKey(query);
  const entry = SEARCH_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) {
    SEARCH_CACHE.delete(key);
    return null;
  }
  return entry.results;
}

function cacheSet(query, results) {
  const key = cacheKey(query);
  SEARCH_CACHE.set(key, { results, ts: Date.now() });

  // Prune if too large
  if (SEARCH_CACHE.size > 200) {
    const oldest = [...SEARCH_CACHE.entries()]
      .sort((a, b) => a[1].ts - b[1].ts)
      .slice(0, 50);
    for (const [k] of oldest) SEARCH_CACHE.delete(k);
  }
}

function formatDocs(results, provider) {
  return results.map((r, i) => ({
    file: `🌐 web:${provider} #${i + 1}`,
    excerpt: `${r.title || ''}\n${r.snippet || r.content || ''}`.trim().slice(0, 500),
    score: 1.0 - i * 0.1,
    source: 'web',
    url: r.url || null,
  }));
}

// ── SearXNG (self-hosted, free, primary) ──────────────────────────────────
async function searchSearXNG(query) {
  if (!config.searxngUrl) return null;

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    category_general: '1',
  });

  try {
    const res = await fetch(`${config.searxngUrl}/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: AbortSignal.timeout(config.searchProviderTimeoutMs || 10_000),
    });

    if (!res.ok) {
      log.warn(`[WebSearch] SearXNG returned ${res.status}`);
      return null;
    }

    const contentType = res.headers.get('content-type') ?? '';
    const text = await res.text();

    // JSON path
    if (contentType.includes('json')) {
      const data = JSON.parse(text);
      return formatDocs(data.results ?? [], 'searxng');
    }

    // HTML scrape path
    const results = [];
    const resultRegex = /<article class="result[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
    let match;
    while ((match = resultRegex.exec(text)) !== null && results.length < (config.searchMaxResults ?? 5)) {
      const block = match[1];
      const urlMatch = block.match(/<a\s[^>]*href="([^"]+)"[^>]*class="url_header"/i)
                    || block.match(/<a\s[^>]*class="url_header"[^>]*href="([^"]+)"/i);
      const titleMatch = block.match(/<h3>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h3>/i);
      const snippetMatch = block.match(/<p\s[^>]*class="content"[^>]*>([\s\S]*?)<\/p>/i);

      if (titleMatch || snippetMatch) {
        results.push({
          url:     urlMatch    ? urlMatch[1]    : '',
          title:   titleMatch  ? titleMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '',
          content: snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() : '',
        });
      }
    }

    return results.length > 0 ? formatDocs(results, 'searxng') : null;
  } catch (err) {
    log.warn(`[WebSearch] SearXNG error: ${err.message}`);
    return null;
  }
}

// ── Tavily Search ──────────────────────────────────────────────────────────
async function searchTavily(query) {
  const apiKey = config.tavilyApiKey || config.tavilyApiKey2;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.searchProviderTimeoutMs || 5000);

  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: config.searchMaxResults || 5,
        include_answer: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn(`[WebSearch] Tavily returned ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    }

    const data = await res.json();
    const results = data.results || [];
    log.info(`[WebSearch] Tavily returned ${results.length} results`);
    return results.length > 0 ? formatDocs(results, 'tavily') : null;
  } catch (err) {
    log.warn(`[WebSearch] Tavily failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Brave Search ───────────────────────────────────────────────────────────
async function searchBrave(query) {
  const apiKey = config.braveSearchApiKey || config.braveSearchApiKey2;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.searchProviderTimeoutMs || 5000);

  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${config.searchMaxResults || 5}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': apiKey,
        },
        signal: controller.signal,
      }
    );

    if (!res.ok) {
      log.warn(`[WebSearch] Brave returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const results = (data.web?.results || []).map(r => ({
      title: r.title,
      snippet: r.description,
      url: r.url,
    }));
    log.info(`[WebSearch] Brave returned ${results.length} results`);
    return results.length > 0 ? formatDocs(results, 'brave') : null;
  } catch (err) {
    log.warn(`[WebSearch] Brave failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── SerpAPI (Google) ───────────────────────────────────────────────────────
async function searchSerpApi(query) {
  const apiKey = config.serpapiApiKey;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.searchProviderTimeoutMs || 5000);

  try {
    const res = await fetch(
      `https://serpapi.com/search?api_key=${apiKey}&q=${encodeURIComponent(query)}&num=${config.searchMaxResults || 5}&engine=google`,
      { signal: controller.signal }
    );

    if (!res.ok) {
      log.warn(`[WebSearch] SerpAPI returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const results = (data.organic_results || []).map(r => ({
      title: r.title,
      snippet: r.snippet,
      url: r.link,
    }));
    log.info(`[WebSearch] SerpAPI returned ${results.length} results`);
    return results.length > 0 ? formatDocs(results, 'serpapi') : null;
  } catch (err) {
    log.warn(`[WebSearch] SerpAPI failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Serper.dev ─────────────────────────────────────────────────────────────
async function searchSerper(query) {
  const apiKey = config.serperApiKey;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.searchProviderTimeoutMs || 5000);

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: config.searchMaxResults || 5 }),
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn(`[WebSearch] Serper returned ${res.status}`);
      return null;
    }

    const data = await res.json();
    const results = (data.organic || []).map(r => ({
      title: r.title,
      snippet: r.snippet,
      url: r.link,
    }));
    log.info(`[WebSearch] Serper returned ${results.length} results`);
    return results.length > 0 ? formatDocs(results, 'serper') : null;
  } catch (err) {
    log.warn(`[WebSearch] Serper failed: ${err.message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Main search function ───────────────────────────────────────────────────
// Priority: SearXNG > Tavily > Brave > Serper > SerpAPI

const PROVIDERS = [
  { name: 'searxng', fn: searchSearXNG },
  { name: 'tavily', fn: searchTavily },
  { name: 'brave', fn: searchBrave },
  { name: 'serper', fn: searchSerper },
  { name: 'serpapi', fn: searchSerpApi },
];

/**
 * Search the web. Returns null if no provider is configured or all fail.
 * @param {string} query
 * @returns {Promise<{docs: Array, provider: string} | null>}
 */
export async function search(query) {
  // Check cache first
  const cached = cacheGet(query);
  if (cached) {
    log.info(`[WebSearch] Cache hit for "${query.slice(0, 60)}"`);
    return cached;
  }

  for (const provider of PROVIDERS) {
    const startedAt = Date.now();
    try {
      const docs = await provider.fn(query);
      if (docs && docs.length > 0) {
        const result = { docs, provider: provider.name, relevant: true };
        cacheSet(query, result);
        log.info(`[WebSearch] ${provider.name} succeeded in ${Date.now() - startedAt}ms, ${docs.length} docs`);
        return result;
      }
      log.info(`[WebSearch] ${provider.name} returned 0 results (${Date.now() - startedAt}ms)`);
    } catch (err) {
      log.warn(`[WebSearch] ${provider.name} error: ${err.message}`);
    }
  }

  log.info(`[WebSearch] All providers exhausted for "${query.slice(0, 60)}"`);
  return null;
}

/**
 * Check if at least one web search provider is configured.
 */
export function isConfigured() {
  return Boolean(
    config.searxngUrl ||
    config.tavilyApiKey || config.tavilyApiKey2 ||
    config.braveSearchApiKey || config.braveSearchApiKey2 ||
    config.serpapiApiKey ||
    config.serperApiKey
  );
}

export function clearCache() {
  SEARCH_CACHE.clear();
}

export function stats() {
  return {
    cacheSize: SEARCH_CACHE.size,
    providersConfigured: isConfigured(),
  };
}
