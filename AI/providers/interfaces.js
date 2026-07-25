// AI/providers/interfaces.js
// Provider interface contracts — every provider implements one of these.
// These are JSDoc typedefs; no runtime enforcement.  Just contracts for humans.
//
// Pattern:
//   Each provider exports a single async function matching its interface.
//   Managers call providers, handle fallbacks, and expose a unified API.

/**
 * @typedef {object} SearchResult
 * @property {string}  content  — snippet or body text
 * @property {string}  url      — source URL
 * @property {string}  title    — page title / heading
 * @property {number}  score    — relevance score (0–1)
 * @property {'web'}   source   — always 'web' for search results
 */

/**
 * SearchProvider — searches the web and returns ranked results.
 *
 * @callback SearchProvider
 * @param {string} query      — user query, already scoped by the manager
 * @param {number} maxResults — max results desired
 * @returns {Promise<SearchResult[]>}
 */

/**
 * @typedef {object} ScrapedPage
 * @property {string} url         — source URL
 * @property {string} markdown    — page content as markdown
 * @property {string} title       — page title
 * @property {object} [metadata]  — optional extra (author, date, …)
 */

/**
 * ScrapeProvider — fetches and extracts a single webpage.
 *
 * @callback ScrapeProvider
 * @param {string} url — fully-qualified URL to scrape
 * @returns {Promise<ScrapedPage>}
 */

/**
 * @typedef {object} AIResponse
 * @property {string} text   — the generated response text
 * @property {string} model  — which model produced it
 * @property {number} tokens — total tokens used (prompt + completion)
 */

/**
 * AIProvider — sends a prompt to an LLM and returns the response.
 *
 * @callback AIProvider
 * @param {string} prompt
 * @param {object} [options]
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @returns {Promise<AIResponse>}
 */

/**
 * @typedef {object} EmbeddingVector
 * @property {number[]} vector — embedding array
 * @property {string}   model  — embedding model name
 * @property {number}   tokens — tokens consumed
 */

/**
 * EmbeddingProvider — generates a vector embedding for the given text.
 *
 * @callback EmbeddingProvider
 * @param {string} text
 * @returns {Promise<EmbeddingVector>}
 */

/**
 * @typedef {object} MemorySearchResult
 * @property {string} id       — document / point ID
 * @property {number} score    — similarity score
 * @property {object} payload  — stored metadata
 */

/**
 * MemoryProvider — stores and retrieves vectors + metadata.
 * Wraps a vector database (Qdrant).
 *
 * @typedef {object} MemoryProvider
 * @property {(collection: string, vector: number[], payload: object, id?: string) => Promise<void>} upsert
 * @property {(collection: string, vector: number[], limit?: number) => Promise<MemorySearchResult[]>} search
 * @property {(collection: string, id: string) => Promise<void>} delete
 */

export const PROVIDER_TYPES = Object.freeze({
  SEARCH:    'search',
  SCRAPE:    'scrape', 
  AI:        'ai',
  EMBEDDING: 'embedding',
  MEMORY:    'memory',
});
