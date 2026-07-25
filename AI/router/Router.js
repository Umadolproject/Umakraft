// AI/router/Router.js
// Router Manager — single entry point that dispatches to the correct manager.
//
// Commands never talk to providers directly.  They call the Router, which
// delegates to the appropriate Manager, which handles provider fallback.

import { search  as searchWeb   } from '../managers/SearchManager.js';
import { scrape  as scrapePage  } from '../managers/ScrapeManager.js';
import { generate as aiGenerate } from '../managers/AIManager.js';
import { embed   as embedText   } from '../managers/EmbeddingManager.js';
import { remember, recall, forget } from '../managers/MemoryManager.js';

/**
 * Route an action to the correct manager.
 *
 * @param {string} action — one of 'search' | 'scrape' | 'ai' | 'embed' | 'remember' | 'recall' | 'forget'
 * @param {*} input        — action-specific input
 * @param {object} [options]
 * @returns {Promise<*>}
 */
export async function route(action, input, options = {}) {
  switch (action) {
    case 'search':
      return searchWeb(input, options);

    case 'scrape':
      return scrapePage(input);

    case 'ai':
      return aiGenerate(input, options);

    case 'embed':
      return embedText(input);

    case 'remember':
      return remember(input.id, input.text, input.payload);

    case 'recall':
      return recall(input, options.limit);

    case 'forget':
      return forget(input);

    default:
      throw new Error(`[Router] Unknown action: "${action}"`);
  }
}

/** Public API — can be imported directly instead of using route() */
export const Router = {
  search:  searchWeb,
  scrape:  scrapePage,
  ai:      aiGenerate,
  embed:   embedText,
  memory:  { remember, recall, forget },
};
