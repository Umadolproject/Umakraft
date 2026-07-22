// AI/Cache.js
// In-memory LRU cache for embeddings and validated AI responses.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/CACHE.md
//
// Two caches:
//   embeddingCache — Float32Array vectors keyed by SHA-256 of the query text
//   responseCache  — validated response objects keyed by SHA-256 of (query + classification + variables)
//
// Both caches use LRU eviction and configurable TTL.
// Cache state is in-memory only — does not survive process restarts.

import { createHash } from 'node:crypto';
import log from '../core/log.js';
import config from './Configuration.js';

// ---------------------------------------------------------------------------
// LRU Store
// ---------------------------------------------------------------------------

/**
 * Minimal LRU store backed by a Map (Map preserves insertion order).
 * On get, the entry is moved to the tail (most recently used).
 * On set, if over capacity the head (least recently used) is evicted.
 *
 * Each entry: { value, expiresAt }
 */
class LRUStore {
  /**
   * @param {number} maxEntries
   * @param {number} ttlMs
   * @param {string} name  — used in log output
   */
  constructor(maxEntries, ttlMs, name) {
    this._max   = maxEntries;
    this._ttl   = ttlMs;
    this._name  = name;
    this._store = new Map();
  }

  /**
   * Look up a key. Returns the stored value or undefined on miss/expiry.
   * @param {string} key
   * @returns {*|undefined}
   */
  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;

    // TTL check
    if (Date.now() > entry.expiresAt) {
      this._store.delete(key);
      this._emitMetric('expire', key);
      return undefined;
    }

    // Move to tail (most recently used)
    this._store.delete(key);
    this._store.set(key, entry);
    return entry.value;
  }

  /**
   * Store a value. Evicts the LRU entry if over capacity.
   * @param {string} key
   * @param {*}      value
   */
  set(key, value) {
    // Remove existing entry so we can re-insert at tail
    if (this._store.has(key)) {
      this._store.delete(key);
    }

    // Evict LRU (head) if at capacity
    if (this._store.size >= this._max) {
      const lruKey = this._store.keys().next().value;
      this._store.delete(lruKey);
      this._emitMetric('evict', lruKey);
    }

    this._store.set(key, { value, expiresAt: Date.now() + this._ttl });
    this._emitMetric('store', key);
  }

  /**
   * Remove all entries.
   */
  clear() {
    this._store.clear();
    log.info(`[AI/Cache] ${this._name} cache cleared.`);
  }

  /** @returns {number} */
  get size() {
    return this._store.size;
  }

  /**
   * @private
   * @param {'hit'|'miss'|'store'|'evict'|'expire'} event
   * @param {string} key
   */
  _emitMetric(event, key) {
    log.debug(JSON.stringify({
      timestamp:  new Date().toISOString(),
      cacheType:  this._name,
      event,
      key:        key.slice(0, 8),   // first 8 chars of SHA-256 per spec
      ttlMs:      event === 'store' ? this._ttl : null,
    }));
  }
}

// ---------------------------------------------------------------------------
// Cache instances
// ---------------------------------------------------------------------------

let _embeddingCache = new LRUStore(
  config.cacheEmbeddingMax,
  config.cacheEmbeddingTtlMs,
  'embedding'
);

let _responseCache = new LRUStore(
  config.cacheResponseMax,
  config.cacheResponseTtlMs,
  'response'
);

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

/**
 * Deterministic SHA-256 key for an embedding lookup.
 * @param {string} query
 * @returns {string}
 */
export function embeddingKey(query) {
  return createHash('sha256')
    .update(query.toLowerCase().trim())
    .digest('hex');
}

/**
 * Deterministic SHA-256 key for a response lookup.
 * Variables are sorted to guarantee key stability regardless of insertion order.
 *
 * @param {string} query
 * @param {string} classification  — topic classification string
 * @param {Record<string, string>} [variables]
 * @returns {string}
 */
export function responseKey(query, classification, variables = {}) {
  const sortedVariables = Object.fromEntries(
    Object.entries(variables).sort(([a], [b]) => a.localeCompare(b))
  );
  const payload = JSON.stringify({
    query: query.toLowerCase().trim(),
    classification,
    variables: sortedVariables,
  });
  return createHash('sha256').update(payload).digest('hex');
}

// ---------------------------------------------------------------------------
// Embedding cache
// ---------------------------------------------------------------------------

/**
 * Return a cached embedding vector, or undefined on miss.
 * @param {string} query
 * @returns {number[]|undefined}
 */
export function getEmbedding(query) {
  if (!config.cacheEnabled) return undefined;
  const key = embeddingKey(query);
  const hit = _embeddingCache.get(key);
  if (hit !== undefined) {
    log.debug(JSON.stringify({
      timestamp: new Date().toISOString(),
      cacheType: 'embedding',
      event:     'hit',
      key:       key.slice(0, 8),
      ttlMs:     null,
    }));
  } else {
    log.debug(JSON.stringify({
      timestamp: new Date().toISOString(),
      cacheType: 'embedding',
      event:     'miss',
      key:       key.slice(0, 8),
      ttlMs:     null,
    }));
  }
  return hit;
}

/**
 * Store an embedding vector.
 * @param {string}   query
 * @param {number[]} vector
 */
export function setEmbedding(query, vector) {
  if (!config.cacheEnabled) return;
  _embeddingCache.set(embeddingKey(query), vector);
}

// ---------------------------------------------------------------------------
// Response cache
// ---------------------------------------------------------------------------

/**
 * @typedef {object} CachedResponse
 * @property {string}   text          — validated response text
 * @property {string[]} citations     — source file paths
 * @property {string}   model         — provider model used
 * @property {number}   tokens        — token count
 */

/**
 * Return a cached validated response, or undefined on miss.
 * Only previously validated responses are stored — never store failed responses.
 *
 * @param {string} query
 * @param {string} classification
 * @param {Record<string, string>} [variables]
 * @returns {CachedResponse|undefined}
 */
export function getResponse(query, classification, variables = {}) {
  if (!config.cacheEnabled) return undefined;
  const key = responseKey(query, classification, variables);
  const hit = _responseCache.get(key);
  if (hit !== undefined) {
    log.debug(JSON.stringify({
      timestamp: new Date().toISOString(),
      cacheType: 'response',
      event:     'hit',
      key:       key.slice(0, 8),
      ttlMs:     null,
    }));
  } else {
    log.debug(JSON.stringify({
      timestamp: new Date().toISOString(),
      cacheType: 'response',
      event:     'miss',
      key:       key.slice(0, 8),
      ttlMs:     null,
    }));
  }
  return hit;
}

/**
 * Store a validated response. Must only be called after the Response Validator
 * has confirmed the response is safe and in-scope.
 *
 * @param {string}         query
 * @param {string}         classification
 * @param {CachedResponse} response
 * @param {Record<string, string>} [variables]
 */
export function setResponse(query, classification, response, variables = {}) {
  if (!config.cacheEnabled) return;
  _responseCache.set(responseKey(query, classification, variables), response);
}

// ---------------------------------------------------------------------------
// Cache management
// ---------------------------------------------------------------------------

/**
 * Flush both caches. Used by the /ai cache clear admin command.
 */
export function clearAll() {
  _embeddingCache.clear();
  _responseCache.clear();
  log.info('[AI/Cache] All caches cleared.');
}

/**
 * Current cache sizes — reported in the Operation health cycle.
 * @returns {{ embeddingSize: number, responseSize: number }}
 */
export function stats() {
  return {
    embeddingSize: _embeddingCache.size,
    responseSize:  _responseCache.size,
  };
}
