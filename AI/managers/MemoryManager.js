// AI/managers/MemoryManager.js
// Memory Manager — stores and retrieves vectors for semantic memory.
//
// Uses a dedicated Qdrant collection ('umakraft_memory') separate from the
// code indexer collection, so conversational memories don't pollute code search.
//
// Backend priority:
//   1. Qdrant Cloud  — if QDRANT_URL + QDRANT_API_KEY are set
//   2. In-memory      — fallback with cosine similarity; resets on restart
//
// Public API:
//   remember(id, text, payload)  → store a document in memory
//   recall(query, limit)         → semantic search across stored documents
//   forget(id)                   → remove a document
//   stats()                      → { backend, size }

import { createHash } from 'node:crypto';
import log from '../../core/log.js';
import config from '../Configuration.js';

// ──────────────────────────────────────────────────────────────────────────────
// Dedicated collection — separate from code indexer
// ──────────────────────────────────────────────────────────────────────────────

const MEMORY_COLLECTION = (config.qdrantCollection ?? 'umakraft') + '_memory';

// ──────────────────────────────────────────────────────────────────────────────
// In-memory fallback (same pattern as AI/VectorDatabase.js)
// ──────────────────────────────────────────────────────────────────────────────

function cosineSimilarity(a, b) {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot  += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

class InMemoryMemoryStore {
  constructor() {
    /** @type {Map<string, {id: string, vector: number[], payload: object}>} */
    this._points = new Map();
    log.info('[MemoryManager] Using in-memory fallback (no Qdrant). Data resets on restart.');
  }

  async upsert(collection, vector, payload, id) {
    this._points.set(id, { id, vector, payload });
  }

  async search(collection, queryVector, limit = 5) {
    const scored = [];
    for (const point of this._points.values()) {
      const score = cosineSimilarity(queryVector, point.vector);
      scored.push({ id: point.id, score, payload: point.payload });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async delete(collection, id) {
    this._points.delete(id);
  }

  get size() {
    return this._points.size;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Backend selection (lazy — loaded on first call)
// ──────────────────────────────────────────────────────────────────────────────

let _backend = null;

function _embedManager() {
  // Lazy import to avoid circular dependency at module load time
  let _embed;
  return async () => {
    if (!_embed) {
      const mod = await import('./EmbeddingManager.js');
      _embed = mod.embed;
    }
    return _embed;
  };
}
const getEmbed = _embedManager();

async function getBackend() {
  if (_backend) return _backend;

  // Try Qdrant first
  if (config.qdrantUrl && (config.qdrantApiKey || config.qdrantUrl.includes('localhost'))) {
    try {
      const { qdrant } = await import('../providers/memory/qdrantProvider.js');
      // Verify connectivity with a cheap operation
      const testUrl = config.qdrantUrl.replace(/\/$/, '') + '/collections';
      const headers = { 'Content-Type': 'application/json' };
      if (config.qdrantApiKey) headers['api-key'] = config.qdrantApiKey;
      const res = await fetch(testUrl, { headers, signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        _backend = qdrant;
        log.info(`[MemoryManager] Using Qdrant backend (collection: ${MEMORY_COLLECTION})`);
        return _backend;
      }
    } catch (err) {
      log.warn(`[MemoryManager] Qdrant unavailable (${err.message}) — falling back to in-memory.`);
    }
  }

  // Fallback: in-memory
  _backend = new InMemoryMemoryStore();
  log.info('[MemoryManager] Using in-memory backend.');
  return _backend;
}

// ──────────────────────────────────────────────────────────────────────────────
// ID generation
// ──────────────────────────────────────────────────────────────────────────────

function memoryId(text, context) {
  const hash = createHash('sha256')
    .update(`${context ?? 'mem'}:${text.slice(0, 100)}:${Date.now()}`)
    .digest('hex')
    .slice(0, 16);
  return `mem-${hash}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Store a document in semantic memory.
 *
 * @param {string} id        — unique document ID
 * @param {string} text      — content to embed and store
 * @param {object} [payload] — metadata (will include text + id automatically)
 */
export async function remember(id, text, payload = {}) {
  const backend = await getBackend();
  const embedFn = await getEmbed();
  const { vector } = await embedFn(text);

  await backend.upsert(MEMORY_COLLECTION, vector, { ...payload, text, id, storedAt: new Date().toISOString() }, id);
  log.debug(`[MemoryManager] Stored "${id}" (${text.length} chars)`);
}

/**
 * Semantic search across stored documents.
 *
 * @param {string} query  — natural language query
 * @param {number} [limit=5]
 * @returns {Promise<Array<{id: string, score: number, payload: object}>>}
 */
export async function recall(query, limit = 5) {
  const backend  = await getBackend();
  const embedFn = await getEmbed();
  const { vector } = await embedFn(query);

  const results = await backend.search(MEMORY_COLLECTION, vector, limit);
  log.debug(`[MemoryManager] Recall "${query.slice(0, 60)}" → ${results.length} result(s)`);
  return results;
}

/**
 * Remove a document from memory.
 * @param {string} id
 */
export async function forget(id) {
  const backend = await getBackend();
  await backend.delete(MEMORY_COLLECTION, id);
}

/**
 * Store a conversation turn as a memory entry.
 * Convenience wrapper used by the Agent after each successful interaction.
 *
 * @param {object} turn
 * @param {string} turn.userId
 * @param {string} turn.channelId
 * @param {string} turn.query      — user's question
 * @param {string} turn.response   — AI answer (truncated to 500 chars)
 * @param {string} turn.topic      — classification topic
 * @param {number} turn.confidence — TopicFilter confidence
 */
export async function storeConversationTurn({ userId, channelId, query, response, topic, confidence } = {}) {
  if (!query || !response) return;

  const text = `User asked: ${query.slice(0, 300)}\nBot answered: ${response.slice(0, 500)}`;
  const id   = memoryId(text, `${userId}:${channelId}`);

  await remember(id, text, {
    type:       'conversation_turn',
    userId,
    channelId,
    topic,
    confidence: confidence ?? null,
    queryPreview: query.slice(0, 200),
    responsePreview: response.slice(0, 300),
  });

  log.info(`[MemoryManager] Stored conversation turn "${id}" (topic=${topic})`);
}

/**
 * Return backend stats for monitoring.
 * @returns {{ backend: string, size: number }}
 */
export function stats() {
  if (!_backend) return { backend: 'uninitialized', size: 0 };

  if (_backend instanceof InMemoryMemoryStore) {
    return { backend: 'in-memory', size: _backend.size };
  }
  return { backend: 'qdrant', size: -1 }; // Qdrant size requires a separate count call
}
