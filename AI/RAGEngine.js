// AI/RAGEngine.js
// Retrieval-Augmented Generation pipeline — query → embed → search → rank → return.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/RAG_ENGINE.md
//
// Public API:
//   retrieve(query, options) — embed a question and return ranked document chunks

import log from '../core/log.js';
import config from './Configuration.js';
import { embed } from './APIProvider.js';
import { search } from './VectorDatabase.js';

// Config values for this module
const MAX_CONTEXT_TOKENS = 6000;
const MIN_CHUNKS         = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {object} RAGChunk
 * @property {string}      chunkId    — vector database point ID
 * @property {string}      filePath
 * @property {string|null} heading
 * @property {string}      department
 * @property {string}      fileType
 * @property {string}      content
 * @property {number}      score      — cosine similarity 0.0–1.0
 * @property {number}      tokenCount
 * @property {string}      source     — always 'repository' for RAG chunks
 */

/**
 * Retrieve the most relevant document chunks for a given query.
 *
 * Steps:
 *  1. Embed the query using APIProvider.embed() (cache-aware)
 *  2. Search the Vector Database for top-k similar chunks
 *  3. Apply optional metadata filter (department, fileType, scope)
 *  4. Sort by descending relevance score
 *  5. Trim to token budget (never below MIN_CHUNKS)
 *  6. Return annotated chunks to the Context Builder
 *
 * @param {string} query — the user's question
 * @param {{
 *   topK?:      number,
 *   minScore?:  number,
 *   filter?:    { department?: string, fileType?: string },
 *   scope?:     'governance' | 'commands' | 'blueprints' | 'source' | 'documentation' | null,
 *   maxTokens?: number,
 * }} [options]
 * @returns {Promise<RAGChunk[]>}
 */
export async function retrieve(query, options = {}) {
  const topK      = options.topK      ?? config.vdbTopK;
  const minScore  = options.minScore  ?? config.vdbMinScore;
  const maxTokens = options.maxTokens ?? MAX_CONTEXT_TOKENS;
  const scope     = options.scope     ?? null;
  const filter    = buildFilter(options.filter ?? {}, scope);

  // Step 1 — embed the query (cache-aware via APIProvider)
  const queryVector = await embed(query);

  // Step 2 — similarity search
  let results = await search(queryVector, { topK, minScore, filter });

  // Step 3 — apply scope restriction (secondary metadata filter for in-memory backend)
  if (scope) {
    const scoped = applyScopeFilter(results, scope);

    if (scoped.length < MIN_CHUNKS && results.length >= MIN_CHUNKS) {
      // Relax scope restriction and note it in results
      log.info(
        `[AI/RAGEngine] Scope "${scope}" returned only ${scoped.length} chunk(s) — ` +
        `relaxing scope restriction (got ${results.length} total).`
      );
      // keep `results` as-is (unscoped) — scoped set was too small
    } else {
      results = scoped;
    }
  }

  // Step 4 — sort by descending score
  results.sort((a, b) => b.score - a.score);

  // Step 5 — trim to token budget (never drop below MIN_CHUNKS)
  results = enforceTokenBudget(results, maxTokens, MIN_CHUNKS);

  // Log retrieval metrics
  const topScore    = results[0]?.score?.toFixed(3) ?? 'n/a';
  const totalTokens = results.reduce((s, c) => s + (c.tokenCount ?? 0), 0);
  log.info(
    `[AI/RAGEngine] Retrieved ${results.length} chunk(s) — ` +
    `top score=${topScore}, total tokens≈${totalTokens}`
  );

  // Step 6 — annotate and return
  return results.map(r => ({
    chunkId:    r.id      ?? '',
    filePath:   r.filePath,
    heading:    r.heading ?? null,
    department: r.department,
    fileType:   r.fileType,
    content:    r.content,
    score:      r.score,
    tokenCount: r.tokenCount ?? Math.ceil((r.content?.length ?? 0) / 4),
    source:     'repository',
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a VectorDatabase filter from optional filter fields and scope.
 */
function buildFilter(filter, scope) {
  const out = { ...filter };

  // Map scope → department or fileType filter
  if (scope === 'governance')    out.department = 'Governance';
  if (scope === 'commands')      out.department = 'Distribution';
  if (scope === 'blueprints')    out.department = 'Workshop';

  return out;
}

/**
 * Apply scope-based filtering on the result list (for backends that don't support it natively).
 *
 * @param {object[]} results
 * @param {string} scope
 * @returns {object[]}
 */
function applyScopeFilter(results, scope) {
  switch (scope) {
    case 'governance':    return results.filter(r => r.department === 'Governance');
    case 'commands':      return results.filter(r => r.department === 'Distribution');
    case 'blueprints':    return results.filter(r => r.department === 'Workshop');
    case 'source':        return results.filter(r => r.fileType   === 'JavaScript' || r.fileType === 'TypeScript');
    case 'documentation': return results.filter(r => r.fileType   === 'Markdown');
    default:              return results;
  }
}

/**
 * Trim the result list to fit within the token budget.
 * Never drops below minChunks.
 *
 * @param {object[]} results — sorted descending by score
 * @param {number}   maxTokens
 * @param {number}   minChunks
 * @returns {object[]}
 */
function enforceTokenBudget(results, maxTokens, minChunks) {
  let total = results.reduce((s, r) => s + (r.tokenCount ?? 0), 0);

  while (total > maxTokens && results.length > minChunks) {
    const removed = results.pop(); // remove lowest-score chunk from tail
    total -= removed.tokenCount ?? 0;
    log.debug(
      `[AI/RAGEngine] Token budget trim — removed "${removed.filePath}" ` +
      `(score=${removed.score?.toFixed(3)}, tokens≈${removed.tokenCount})`
    );
  }

  return results;
}
