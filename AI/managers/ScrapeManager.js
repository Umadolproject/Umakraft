// AI/managers/ScrapeManager.js
// Scrape Manager — fetches webpage content as clean markdown.
//
// Single provider: Firecrawl.  Designed for future expansion (additional
// scrape providers just need to implement the ScrapeProvider interface).

import log from '../../core/log.js';
import { scrape as firecrawlScrape } from '../providers/scrape/firecrawlProvider.js';

/** @type {import('../providers/interfaces.js').ScrapeProvider[]} */
const providers = [firecrawlScrape];

/**
 * Scrape a URL — tries providers in order.
 *
 * @param {string} url
 * @returns {Promise<import('../providers/interfaces.js').ScrapedPage>}
 */
export async function scrape(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('[ScrapeManager] URL is required');
  }

  for (const provider of providers) {
    try {
      const result = await provider(url);
      if (result.markdown) return result;
      log.warn('[ScrapeManager] Provider returned empty content — trying next.');
    } catch (err) {
      log.warn(`[ScrapeManager] Provider failed: ${err.message}`);
    }
  }

  throw new Error('[ScrapeManager] All scrape providers failed.');
}
