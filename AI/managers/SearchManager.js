// AI/managers/SearchManager.js
// Search Manager — orchestrates search providers with fallback chain.
//
// Chain: Tavily → Brave → Google CSE → SerpAPI (existing) → Serper (new) → Firecrawl (new)
// Wraps the existing WebSearchEngine chain plus the new providers.

import log from '../../core/log.js';
import config from '../Configuration.js';

// Existing providers (wrapped from WebSearchEngine internals)
import * as webSearchEngine from '../WebSearchEngine.js';

// New providers
import { search as serperSearch } from '../providers/search/serperProvider.js';
import { search as firecrawlSearch } from '../providers/search/firecrawlSearchProvider.js';

/**
 * Scope a query with Umamusume domain context for better results.
 * Covers all 5 trusted Umamusume reference sites.
 * @param {string} query
 * @returns {string}
 */
function scopeQuery(query) {
  const q = query.trim();
  if (!q) return q;
  const UMA_DOMAINS = ['uma.moe', 'gametora.com/umamusume', 'uma.guide', 'umamusume.com', 'game8.co/games/umamusume'];
  if (UMA_DOMAINS.some(d => q.toLowerCase().includes(d.toLowerCase()))) return q;
  if (q.toLowerCase().includes('umamusume')) return q;
  return `${q} Umamusume Pretty Derby`;
}

/**
 * Search the web — tries providers in priority order.
 * Falls back on error, timeout, or rate limit.
 *
 * @param {string} query
 * @param {{ maxResults?: number }} [options]
 * @returns {Promise<import('../providers/interfaces.js').SearchResult[]>}
 */
export async function search(query, options = {}) {
  const maxResults = options.maxResults ?? config.searchMaxResults ?? 5;
  const scoped     = scopeQuery(query);

  // Delegate to the existing battle-tested WebSearchEngine chain
  // (Tavily → Brave → Google CSE → SerpAPI).
  // It already handles key rotation, caching, and timeout internally.
  try {
    const results = await webSearchEngine.search(scoped, { maxResults });
    if (results.length > 0) return results;
  } catch (err) {
    log.warn(`[SearchManager] Primary search chain failed: ${err.message}`);
  }

  // Fallback 1: Serper — fast Google Search API, cheap ($0.30/1k queries).
  // Excellent for docs/code questions that Tavily's AI-optimized search may miss.
  try {
    log.info('[SearchManager] Trying Serper Search fallback...');
    const serperResults = await serperSearch(scoped, maxResults);
    if (serperResults.length > 0) {
      log.info(`[SearchManager] Serper returned ${serperResults.length} result(s)`);
      return serperResults;
    }
  } catch (err) {
    log.warn(`[SearchManager] Serper fallback failed: ${err.message}`);
  }

  // Fallback 2: Firecrawl Search
  try {
    log.info('[SearchManager] Trying Firecrawl Search fallback...');
    const results = await firecrawlSearch(scoped, maxResults);
    if (results.length > 0) {
      log.info(`[SearchManager] Firecrawl returned ${results.length} result(s)`);
      return results;
    }
  } catch (err) {
    log.warn(`[SearchManager] Firecrawl fallback failed: ${err.message}`);
  }

  log.warn('[SearchManager] All search providers exhausted — returning empty.');
  return [];
}
