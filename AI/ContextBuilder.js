// AI/ContextBuilder.js
// Assembles the context window passed to the Prompt System.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/CONTEXT_BUILDER.md
//
// Receives ranked chunks from one or more sources (RAG Engine, Knowledge Engine,
// Web Search Engine), merges, deduplicates, formats, enforces token budget,
// and emits a single context block string injected as {{context}}.
//
// Public API:
//   build(sources, options) — assemble and return { context, citations, totalTokens }

import log from '../core/log.js';

// Minimum chunks to preserve even when trimming for token budget
const MIN_CHUNKS = parseInt(process.env.RAG_MIN_CHUNKS ?? '3', 10);

// ---------------------------------------------------------------------------
// Types (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} Chunk
 * @property {string}      filePath    — for repository chunks; URL for web chunks
 * @property {string|null} heading     — nearest section heading
 * @property {string}      content     — raw text
 * @property {number}      score       — relevance score 0.0–1.0
 * @property {number}      [tokenCount]
 * @property {'repository'|'web'|'knowledge'} source
 */

/**
 * @typedef {object} BuiltContext
 * @property {string}   context      — formatted context block for {{context}} injection
 * @property {string[]} citations    — deduplicated list of source references
 * @property {number}   totalTokens  — estimated token count of the context block
 * @property {number}   chunkCount   — number of chunks included
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a context block from one or more chunk sources.
 *
 * @param {Chunk[][]} sources       — array of chunk arrays (e.g. [ragChunks, webChunks])
 * @param {{ maxTokens?: number }}  [options]
 * @returns {BuiltContext}
 */
export function build(sources, options = {}) {
  const maxTokens = options.maxTokens ?? 6000;

  // 1. Merge all source arrays into one pool
  const pool = sources.flat();

  if (pool.length === 0) {
    log.info('[AI/ContextBuilder] No chunks received — empty context.');
    return { context: '', citations: [], totalTokens: 0, chunkCount: 0 };
  }

  // 2. Deduplicate: same filePath + same heading → keep higher score
  const deduped = deduplicate(pool);

  // 3. Sort descending by score
  deduped.sort((a, b) => b.score - a.score);

  // 4. Enforce token budget (never drop below MIN_CHUNKS)
  const trimmed = enforceTokenBudget(deduped, maxTokens);

  // 5. Format each chunk into a citation block
  const blocks = trimmed.map((chunk, i) => formatChunk(chunk, i + 1));

  // 6. Assemble the final context string
  const context = blocks.join('\n');

  // 7. Build the citation list (deduplicated source references)
  const citations = buildCitationList(trimmed);

  const totalTokens = Math.ceil(context.length / 4);

  log.info(
    `[AI/ContextBuilder] Context assembled — ` +
    `${trimmed.length} chunk(s), ≈${totalTokens} tokens, ` +
    `${citations.length} unique source(s).`
  );

  return { context, citations, totalTokens, chunkCount: trimmed.length };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a single chunk into the citation block format specified in the spec.
 * Repository chunks use the file path; web chunks use a [WEB] prefix tag.
 *
 * @param {Chunk}  chunk
 * @param {number} index — 1-based position in context
 * @returns {string}
 */
function formatChunk(chunk, index) {
  const sourceLabel = chunk.source === 'web'
    ? `[WEB] ${chunk.filePath}`
    : chunk.filePath;

  const sectionLine = chunk.heading
    ? `Section: ${chunk.heading}`
    : null;

  const scoreStr = typeof chunk.score === 'number'
    ? chunk.score.toFixed(2)
    : 'n/a';

  const header = [
    `[SOURCE ${index}]`,
    '---',
    `Source: ${sourceLabel}`,
    sectionLine,
    `Relevance: ${scoreStr}`,
    '---',
  ].filter(Boolean).join('\n');

  return `${header}\n${chunk.content.trim()}\n---`;
}

/**
 * Build a flat, deduplicated list of source references for citation display.
 *
 * @param {Chunk[]} chunks
 * @returns {string[]}
 */
function buildCitationList(chunks) {
  const seen = new Set();
  const citations = [];

  for (const chunk of chunks) {
    const key = chunk.source === 'web'
      ? `[WEB] ${chunk.filePath}`
      : chunk.heading
        ? `${chunk.filePath} — ${chunk.heading}`
        : chunk.filePath;

    if (!seen.has(key)) {
      seen.add(key);
      citations.push(key);
    }
  }

  return citations;
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

/**
 * Remove duplicate chunks (same filePath + same heading).
 * When duplicates exist, keep the one with the higher score.
 *
 * @param {Chunk[]} chunks
 * @returns {Chunk[]}
 */
function deduplicate(chunks) {
  /** @type {Map<string, Chunk>} */
  const best = new Map();

  for (const chunk of chunks) {
    const key = `${chunk.filePath}::${chunk.heading ?? '__null__'}`;
    const existing = best.get(key);
    if (!existing || chunk.score > existing.score) {
      best.set(key, chunk);
    }
  }

  return [...best.values()];
}

// ---------------------------------------------------------------------------
// Token budget enforcement
// ---------------------------------------------------------------------------

/**
 * Trim lowest-relevance chunks until the total estimated token count
 * fits within maxTokens. Never drops below MIN_CHUNKS.
 *
 * @param {Chunk[]} chunks — sorted descending by score
 * @param {number}  maxTokens
 * @returns {Chunk[]}
 */
function enforceTokenBudget(chunks, maxTokens) {
  const withTokens = chunks.map(c => ({
    ...c,
    tokenCount: c.tokenCount ?? Math.ceil((c.content?.length ?? 0) / 4),
  }));

  let total = withTokens.reduce((s, c) => s + c.tokenCount, 0);

  while (total > maxTokens && withTokens.length > MIN_CHUNKS) {
    const removed = withTokens.pop();
    total -= removed.tokenCount;
    log.debug(
      `[AI/ContextBuilder] Token budget trim — removed "${removed.filePath}" ` +
      `(score=${removed.score?.toFixed(3)}, tokens≈${removed.tokenCount})`
    );
  }

  return withTokens;
}
