// AI/cache.js
// Response cache for the local AI service.
// Keys now include query + command mode + retrieval mode to avoid response-shape collisions.

import { createHash } from 'node:crypto';
import log from '../core/log.js';

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
    };
  }

  return {
    query: String(input?.query ?? '').toLowerCase().trim(),
    commandMode: String(input?.commandMode ?? 'unknown').toLowerCase().trim(),
    retrievalMode: String(input?.retrievalMode ?? 'unknown').toLowerCase().trim(),
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
