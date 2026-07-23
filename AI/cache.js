// AI/cache.js
// Response cache for the local AI service.
//
// Simple LRU map keyed by SHA-256 of the normalised question text.
// Separate from AI/Cache.js (which serves the cloud pipeline).
//
// Public API:
//   get(question)         → string | null
//   set(question, text)   → void
//   stats()               → { size: number, maxSize: number }

import { createHash } from 'node:crypto';
import log from '../core/log.js';

const MAX_ENTRIES = 200;
const TTL_MS      = 3_600_000; // 1 hour

/** @type {Map<string, { text: string, expiresAt: number }>} */
const _store = new Map();

function key(question) {
  return createHash('sha256')
    .update(question.toLowerCase().trim())
    .digest('hex')
    .slice(0, 16);
}

/**
 * Look up a cached response. Returns null on miss or expiry.
 * @param {string} question
 * @returns {string | null}
 */
export function get(question) {
  const k = key(question);
  const entry = _store.get(k);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(k);
    return null;
  }
  // Move to tail (most-recently-used)
  _store.delete(k);
  _store.set(k, entry);
  log.debug(`[AI/LocalCache] hit — key=${k}`);
  return entry.text;
}

/**
 * Store a response in the cache.
 * @param {string} question
 * @param {string} text
 */
export function set(question, text) {
  const k = key(question);
  // Evict LRU (head of Map) if at capacity
  if (_store.size >= MAX_ENTRIES) {
    const oldest = _store.keys().next().value;
    _store.delete(oldest);
  }
  _store.set(k, { text, expiresAt: Date.now() + TTL_MS });
  log.debug(`[AI/LocalCache] stored — key=${k} size=${_store.size}`);
}

/** @returns {{ size: number, maxSize: number }} */
export function stats() {
  return { size: _store.size, maxSize: MAX_ENTRIES };
}
