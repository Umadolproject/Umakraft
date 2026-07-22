// AI/WebSearchEngine.js
// Live data retrieval via web search — Tavily primary, Brave/Google CSE/SerpAPI fallback.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/WEB_SEARCH_ENGINE.md
//
// Public API:
//   search(query, options)                      — primary path (live classification)
//   searchFallback(query, localConfidence)      — fallback from low-confidence RAG/KE result

import log from '../core/log.js';
import config from './Configuration.js';
import { getResponse, setResponse } from './Cache.js';

// ---------------------------------------------------------------------------
// Shared chunk schema
// ---------------------------------------------------------------------------
// { content, filePath, heading, score, source: 'web' }
// Identical shape to RAGEngine chunks — ContextBuilder accepts both.

// ---------------------------------------------------------------------------
// Query scoping
// ---------------------------------------------------------------------------

/**
 * Augment a user query with uma.moe domain context to improve result relevance.
 * @param {string} query
 * @returns {string}
 */
function scopeQuery(query) {
  const q = query.trim();
  if (!q) return q;
  // Don't double-inject if already scoped
  if (q.toLowerCase().includes('uma.moe') || q.toLowerCase().includes('umamusume')) return q;
  return `${q} uma.moe Umamusume Pretty Derby`;
}

// ---------------------------------------------------------------------------
// Per-provider callers
// ---------------------------------------------------------------------------

async function callTavily(query, maxResults) {
  if (!config.tavilyApiKey) throw new Error('TAVILY_API_KEY not set');

  const res = await fetch('https://api.tavily.com/search', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key:         config.tavilyApiKey,
      query,
      search_depth:    'advanced',
      max_results:     maxResults,
      include_domains: ['uma.moe'],
      include_answer:  false,
    }),
    signal: AbortSignal.timeout(config.searchProviderTimeoutMs),
  });

  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return (data.results ?? []).map((r, i) => ({
    content:  r.content  ?? r.raw_content ?? '',
    filePath: r.url      ?? '',
    heading:  r.title    ?? '',
    score:    r.score    ?? Math.max(1.0 - i * 0.05, 0.1),
    source:   'web',
  }));
}

async function callBrave(query, maxResults) {
  if (!config.braveSearchApiKey) throw new Error('BRAVE_SEARCH_API_KEY not set');

  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`;
  const res = await fetch(url, {
    headers: {
      'Accept':               'application/json',
      'Accept-Encoding':      'gzip',
      'X-Subscription-Token': config.braveSearchApiKey,
    },
    signal: AbortSignal.timeout(config.searchProviderTimeoutMs),
  });

  if (!res.ok) throw new Error(`Brave ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return (data.web?.results ?? []).map((r, i) => ({
    content:  r.description ?? '',
    filePath: r.url         ?? '',
    heading:  r.title       ?? '',
    score:    Math.max(1.0 - i * 0.05, 0.1),
    source:   'web',
  }));
}

async function callGoogleCSE(query, maxResults) {
  if (!config.googleCseApiKey || !config.googleCseCx) {
    throw new Error('GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX not set');
  }

  const url =
    `https://www.googleapis.com/customsearch/v1` +
    `?key=${config.googleCseApiKey}&cx=${config.googleCseCx}` +
    `&q=${encodeURIComponent(query)}&num=${Math.min(maxResults, 10)}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.searchProviderTimeoutMs),
  });

  if (!res.ok) throw new Error(`Google CSE ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return (data.items ?? []).map((item, i) => ({
    content:  item.snippet ?? '',
    filePath: item.link    ?? '',
    heading:  item.title   ?? '',
    score:    Math.max(1.0 - i * 0.05, 0.1),
    source:   'web',
  }));
}

async function callSerpAPI(query, maxResults) {
  if (!config.serpapiApiKey) throw new Error('SERPAPI_API_KEY not set');

  const url =
    `https://serpapi.com/search.json` +
    `?api_key=${config.serpapiApiKey}&q=${encodeURIComponent(query)}&num=${maxResults}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(config.searchProviderTimeoutMs),
  });

  if (!res.ok) throw new Error(`SerpAPI ${res.status}: ${await res.text()}`);
  const data = await res.json();

  return (data.organic_results ?? []).map((r, i) => ({
    content:  r.snippet ?? '',
    filePath: r.link    ?? '',
    heading:  r.title   ?? '',
    score:    Math.max(1.0 - i * 0.05, 0.1),
    source:   'web',
  }));
}

// ---------------------------------------------------------------------------
// Search Manager — provider chain with failover
// ---------------------------------------------------------------------------

const PROVIDERS = [
  { name: 'Tavily',     fn: callTavily,    failoverEvent: 'TAVILY_FAILOVER'    },
  { name: 'Brave',      fn: callBrave,     failoverEvent: 'BRAVE_FAILOVER'     },
  { name: 'Google CSE', fn: callGoogleCSE, failoverEvent: 'GCSE_FAILOVER'      },
  { name: 'SerpAPI',    fn: callSerpAPI,   failoverEvent: null                  },
];

/**
 * Internal Search Manager — tries providers in order.
 * Advances on error, timeout, or rate-limit (not on empty results).
 *
 * @param {string} scopedQuery
 * @param {number} maxResults
 * @returns {Promise<Array<{content,filePath,heading,score,source}>>}
 */
async function searchManager(scopedQuery, maxResults) {
  for (let i = 0; i < PROVIDERS.length; i++) {
    const { name, fn, failoverEvent } = PROVIDERS[i];
    try {
      const chunks = await fn(scopedQuery, maxResults);
      log.info(`[AI/WebSearchEngine] Provider "${name}" returned ${chunks.length} result(s).`);
      return chunks;
    } catch (err) {
      log.warn(`[AI/WebSearchEngine] Provider "${name}" failed: ${err.message}`);
      if (failoverEvent) {
        log.info(`[AI/WebSearchEngine] ${failoverEvent} — moving to next provider.`);
      }
      // Continue to next provider
    }
  }

  log.error('[AI/WebSearchEngine] SEARCH_ALL_PROVIDERS_FAILED — returning empty array.');
  return [];
}

// ---------------------------------------------------------------------------
// Cache key
// ---------------------------------------------------------------------------

function cacheKey(query) {
  return `web:${query.toLowerCase().trim().slice(0, 200)}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Primary search — called when Topic Filter classifies the request as 'live'.
 *
 * @param {string} query — original user question
 * @param {{ maxResults?: number }} [options]
 * @returns {Promise<Array<{content,filePath,heading,score,source:'web'}>>}
 */
export async function search(query, options = {}) {
  const maxResults = options.maxResults ?? config.searchMaxResults;
  const scoped     = scopeQuery(query);

  // Cache check
  const cacheHit = getResponse(scoped, 'web:search');
  if (cacheHit) {
    log.info(`[AI/WebSearchEngine] Cache hit for "${scoped.slice(0, 60)}"`);
    return cacheHit.chunks ?? [];
  }

  log.info(`[AI/WebSearchEngine] Searching: "${scoped.slice(0, 80)}"`);
  const chunks = await searchManager(scoped, maxResults);

  // Cache the result
  if (chunks.length > 0) {
    setResponse(scoped, 'web:search', { chunks, model: 'web', tokens: 0, citations: [] });
  }

  return chunks;
}

/**
 * Fallback search — called when RAG or Knowledge Engine confidence is below threshold.
 * Only triggers when localConfidence < SEARCH_CONFIDENCE_FALLBACK.
 *
 * @param {string} query
 * @param {number} localConfidence — 0.0–1.0
 * @returns {Promise<Array<{content,filePath,heading,score,source:'web'}>>}
 */
export async function searchFallback(query, localConfidence) {
  const threshold = config.searchConfidenceFallback;
  if (localConfidence >= threshold) {
    log.debug(
      `[AI/WebSearchEngine] Fallback skipped — confidence ${localConfidence.toFixed(2)} ≥ ${threshold}`
    );
    return [];
  }

  log.info(
    `[AI/WebSearchEngine] Fallback triggered — confidence ${localConfidence.toFixed(2)} < ${threshold}`
  );

  return search(query);
}
