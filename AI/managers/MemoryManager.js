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
// Memory tiers (Chapter 7 — Learning & Experience):
//   core      — essential facts, never auto-decay (confidence stays high)
//   working   — recent interactions, decay after 7 days
//   ephemeral — one-off context, can be aggressively pruned
//
// Public API:
//   remember(id, text, payload, tier?)  → store a document in memory
//   recall(query, limit)                 → semantic search (tier-weighted)
//   forget(id)                           → remove a document
//   stats()                              → { backend, size }
//   decayEphemeral()                     → prune stale ephemeral memories

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
 * @param {object} [payload] — metadata (will include text + id + tier automatically)
 * @param {'core'|'working'|'ephemeral'} [tier='working'] — memory tier
 */
export async function remember(id, text, payload = {}, tier = 'working') {
  const backend = await getBackend();
  const embedFn = await getEmbed();
  const { vector } = await embedFn(text);

  await backend.upsert(MEMORY_COLLECTION, vector, {
    ...payload,
    text,
    id,
    tier,
    storedAt: new Date().toISOString(),
  }, id);
  log.debug(`[MemoryManager] Stored "${id}" (${text.length} chars, tier=${tier})`);
}

/**
 * Semantic search across stored documents with tier weighting.
 * Core tier results get a +0.10 boost, ephemeral get -0.10 penalty.
 * Results older than 7 days in working tier get additional -0.05/day penalty.
 *
 * @param {string} query  — natural language query
 * @param {number} [limit=5]
 * @returns {Promise<Array<{id: string, score: number, payload: object}>>}
 */
export async function recall(query, limit = 5) {
  const backend  = await getBackend();
  const embedFn = await getEmbed();
  const { vector } = await embedFn(query);

  const results = await backend.search(MEMORY_COLLECTION, vector, Math.max(limit * 2, 10));

  // Apply tier weighting and temporal decay
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  for (const r of results) {
    const tier = r.payload?.tier ?? 'working';
    const storedAt = r.payload?.storedAt ? new Date(r.payload.storedAt).getTime() : now;
    const ageDays = (now - storedAt) / DAY_MS;

    // Tier boost/penalty
    switch (tier) {
      case 'core':      r.score += 0.10; break;
      case 'ephemeral': r.score -= 0.10; break;
      default: break; // working — no adjustment
    }

    // Temporal decay for working tier (>7 days old)
    if (tier === 'working' && ageDays > 7) {
      r.score -= 0.05 * (ageDays - 7);
    }
    // Ephemeral decays faster (>1 day)
    if (tier === 'ephemeral' && ageDays > 1) {
      r.score -= 0.15 * (ageDays - 1);
    }
  }

  // Re-sort after adjustments
  results.sort((a, b) => b.score - a.score);

  const top = results.slice(0, limit);
  log.debug(`[MemoryManager] Recall "${query.slice(0, 60)}" → ${top.length}/${results.length} result(s) (tier-weighted)`);
  return top;
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
  }, 'working');

  log.info(`[MemoryManager] Stored conversation turn "${id}" (topic=${topic})`);
}

/**
 * Prune stale ephemeral memories. Ephemeral memories older than 24 hours
 * and working memories older than 30 days are removed.
 * Call periodically or on low-memory conditions.
 *
 * @returns {Promise<number>} number of pruned entries (in-memory only; Qdrant is approximate)
 */
export async function decayEphemeral() {
  const backend = await getBackend();

  if (backend instanceof InMemoryMemoryStore) {
    const now = Date.now();
    const DAY_MS = 24 * 60 * 60 * 1000;
    let pruned = 0;

    for (const [id, point] of backend._points) {
      const tier = point.payload?.tier ?? 'working';
      const storedAt = point.payload?.storedAt ? new Date(point.payload.storedAt).getTime() : now;
      const ageDays = (now - storedAt) / DAY_MS;

      if (tier === 'ephemeral' && ageDays > 1) { backend._points.delete(id); pruned++; }
      else if (tier === 'working' && ageDays > 30) { backend._points.delete(id); pruned++; }
    }

    log.info(`[MemoryManager] Decay pruned ${pruned} stale memories (in-memory)`);
    return pruned;
  }

  // Qdrant: we can't easily prune by age without a collection scan.
  // Recommend running this periodically via the Qdrant dashboard.
  log.debug('[MemoryManager] Decay skipped — Qdrant backend (requires manual maintenance)');
  return 0;
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
