// AI/cache.js
// Response cache for the local AI service.
// Keys now include query + command mode + retrieval mode to avoid response-shape collisions.

import { createHash } from 'node:crypto';
import log from '../core/log.js';
import FAQ_WARMERS from './knowledge/faqWarmers.js';

const MAX_ENTRIES = 200;
const TTL_MS = 3_600_000; // 1 hour

/** @type {Map<string, { text: string, expiresAt: number, cacheKey: object }>} */
const _store = new Map();

const _metrics = {
  hits: 0,
  misses: 0,
  writes: 0,
  evictions: 0,
};

function normaliseCacheKey(input) {
  if (typeof input === 'string') {
    return {
      query: input.toLowerCase().trim(),
      commandMode: 'legacy',
      retrievalMode: 'legacy',
      mode: 'legacy',
    };
  }

  return {
    query: String(input?.query ?? '').toLowerCase().trim(),
    commandMode: String(input?.commandMode ?? 'unknown').toLowerCase().trim(),
    retrievalMode: String(input?.retrievalMode ?? 'unknown').toLowerCase().trim(),
    mode: String(input?.mode ?? 'command').toLowerCase().trim(),
  };
}

function key(input) {
  const normalised = normaliseCacheKey(input);
  return createHash('sha256')
    .update(JSON.stringify(normalised))
    .digest('hex')
    .slice(0, 16);
}

export function get(input) {
  const cacheKey = normaliseCacheKey(input);
  const k = key(cacheKey);
  const entry = _store.get(k);

  if (!entry) {
    _metrics.misses += 1;
    log.debug(`[AI/LocalCache] miss — key=${k} mode=${cacheKey.commandMode} retrieval=${cacheKey.retrievalMode}`);
    return null;
  }

  if (Date.now() > entry.expiresAt) {
    _store.delete(k);
    _metrics.misses += 1;
    log.debug(`[AI/LocalCache] expired — key=${k}`);
    return null;
  }

  _store.delete(k);
  _store.set(k, entry);
  _metrics.hits += 1;
  log.debug(`[AI/LocalCache] hit — key=${k} mode=${cacheKey.commandMode} retrieval=${cacheKey.retrievalMode}`);
  return entry.text;
}

export function set(input, text) {
  const cacheKey = normaliseCacheKey(input);
  const k = key(cacheKey);

  if (_store.size >= MAX_ENTRIES) {
    const oldest = _store.keys().next().value;
    _store.delete(oldest);
    _metrics.evictions += 1;
  }

  _store.set(k, {
    text,
    expiresAt: Date.now() + TTL_MS,
    cacheKey,
  });
  _metrics.writes += 1;

  log.debug(`[AI/LocalCache] stored — key=${k} mode=${cacheKey.commandMode} retrieval=${cacheKey.retrievalMode} size=${_store.size}`);
}

export function stats() {
  return {
    size: _store.size,
    maxSize: MAX_ENTRIES,
    hits: _metrics.hits,
    misses: _metrics.misses,
    writes: _metrics.writes,
    evictions: _metrics.evictions,
  };
}

/**
 * Pre-warm the cache with high-frequency FAQ answers on startup.
 * These are hand-written personality-rich responses — instant replies, zero AI cost.
 * Safe to call multiple times; subsequent calls are no-ops if entries already exist.
 */
export function prewarm() {
  if (!FAQ_WARMERS || FAQ_WARMERS.length === 0) return;

  let seeded = 0;
  for (const entry of FAQ_WARMERS) {
    const cacheKey = {
      query: entry.query,
      commandMode: entry.commandMode ?? 'ask',
      retrievalMode: entry.retrievalMode ?? 'local_docs',
    };
    // Only seed if not already cached (avoids overwriting any runtime cache)
    const existing = get(cacheKey);
    if (!existing) {
      set(cacheKey, entry.text);
      seeded += 1;
    }
  }

  if (seeded > 0) {
    log.info(`[AI/LocalCache] Pre-warmed ${seeded}/${FAQ_WARMERS.length} FAQ entries (${_store.size} total cached)`);
  } else {
    log.debug(`[AI/LocalCache] Pre-warm skipped — all ${FAQ_WARMERS.length} FAQ entries already cached`);
  }
}
