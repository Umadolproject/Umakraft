// AI/VectorDatabase.js
// Vector database layer — Qdrant Cloud when configured, in-memory fallback otherwise.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/VECTOR_DATABASE.md
//
// Priority order (per user requirement):
//   1. Qdrant Cloud — if QDRANT_URL + QDRANT_API_KEY are set
//   2. In-memory    — resets on restart; for development/testing only
//
// Public API:
//   initialize()                        — create collection if needed
//   upsert(points)                      — store/update embedding records
//   search(queryVector, options)        — cosine similarity search
//   deleteByFile(filePath)              — remove all chunks for a file
//   getChecksum(filePath)               — retrieve stored checksum
//   listAllFilePaths()                  — all indexed file paths (for stale cleanup)
//   stats()                             — chunk count + backend info

import { createHash } from 'node:crypto';
import log from '../core/log.js';
import config from './Configuration.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a Qdrant-compatible UUID string from a file path and chunk index.
 * Spec: SHA-256(`${filePath}:${chunkIndex}`), first 32 hex chars, 8-4-4-4-12 format.
 *
 * @param {string} filePath
 * @param {number} chunkIndex
 * @returns {string}
 */
export function deriveChunkId(filePath, chunkIndex) {
  const hex = createHash('sha256')
    .update(`${filePath}:${chunkIndex}`)
    .digest('hex')
    .slice(0, 32);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Cosine similarity between two equal-length float arrays.
 * Returns a value in [-1, 1]; higher = more similar.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number}
 */
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

// ---------------------------------------------------------------------------
// In-memory backend
// ---------------------------------------------------------------------------

class InMemoryBackend {
  constructor() {
    /** @type {Map<string, object>} id → full record */
    this._points   = new Map();
    /** @type {Map<string, string>} filePath → checksum */
    this._checksums = new Map();
    log.info('[AI/VectorDatabase] Using in-memory backend (no QDRANT_URL set). Data resets on restart.');
  }

  async initialize() {
    // Nothing to create for in-memory
  }

  async upsert(points) {
    for (const p of points) {
      this._points.set(p.id, p);
      if (p.payload?.filePath && p.payload?.checksum) {
        this._checksums.set(p.payload.filePath, p.payload.checksum);
      }
    }
    log.info(`[AI/VectorDatabase] In-memory upsert — ${points.length} point(s).`);
  }

  async search(queryVector, { topK, minScore, filter = {} } = {}) {
    const results = [];

    for (const point of this._points.values()) {
      // Apply metadata filter
      if (filter.department && point.payload?.department !== filter.department) continue;
      if (filter.fileType   && point.payload?.fileType   !== filter.fileType)   continue;

      const score = cosineSimilarity(queryVector, point.vector);
      if (score >= minScore) {
        results.push({ ...point.payload, id: point.id, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async deleteByFile(filePath) {
    let deleted = 0;
    for (const [id, point] of this._points) {
      if (point.payload?.filePath === filePath) {
        this._points.delete(id);
        deleted++;
      }
    }
    this._checksums.delete(filePath);
    log.info(`[AI/VectorDatabase] In-memory delete — ${deleted} chunk(s) for "${filePath}".`);
  }

  async getChecksum(filePath) {
    return this._checksums.get(filePath) ?? null;
  }

  async listAllFilePaths() {
    return [...new Set(
      [...this._points.values()].map(p => p.payload?.filePath).filter(Boolean)
    )];
  }

  get size() { return this._points.size; }
  get backendName() { return 'in-memory'; }
}

// ---------------------------------------------------------------------------
// Qdrant backend
// ---------------------------------------------------------------------------

class QdrantBackend {
  constructor() {
    this._collection = config.qdrantCollection;
    this._dim        = config.vdbEmbeddingDim;
    this._client     = null;
  }

  async _getClient() {
    if (this._client) return this._client;
    // Dynamic import so the module loads even without the package installed
    const { QdrantClient } = await import('@qdrant/js-client-rest');
    this._client = new QdrantClient({
      url:    config.qdrantUrl,
      apiKey: config.qdrantApiKey,
    });
    return this._client;
  }

  async initialize() {
    const client = await this._getClient();
    const collections = await client.getCollections();
    const exists = collections.collections.some(c => c.name === this._collection);

    if (!exists) {
      await client.createCollection(this._collection, {
        vectors: { size: this._dim, distance: 'Cosine' },
      });
      log.info(`[AI/VectorDatabase] Qdrant collection "${this._collection}" created (dim=${this._dim}).`);
    } else {
      log.info(`[AI/VectorDatabase] Qdrant collection "${this._collection}" already exists.`);
    }
  }

  async upsert(points) {
    const client = await this._getClient();
    const qdrantPoints = points.map(p => ({
      id:      p.id,
      vector:  p.vector,
      payload: p.payload,
    }));
    await client.upsert(this._collection, { wait: true, points: qdrantPoints });
    log.info(`[AI/VectorDatabase] Qdrant upsert — ${points.length} point(s).`);
  }

  async search(queryVector, { topK, minScore, filter = {} } = {}) {
    const client = await this._getClient();

    const must = [];
    if (filter.department) must.push({ key: 'department', match: { value: filter.department } });
    if (filter.fileType)   must.push({ key: 'fileType',   match: { value: filter.fileType }   });

    const res = await client.search(this._collection, {
      vector:          queryVector,
      limit:           topK,
      score_threshold: minScore,
      filter:          must.length > 0 ? { must } : undefined,
      with_payload:    true,
    });

    return res.map(r => ({ ...r.payload, id: r.id, score: r.score }));
  }

  async deleteByFile(filePath) {
    const client = await this._getClient();
    await client.delete(this._collection, {
      wait:   true,
      filter: { must: [{ key: 'filePath', match: { value: filePath } }] },
    });
    log.info(`[AI/VectorDatabase] Qdrant delete — chunks for "${filePath}".`);
  }

  async getChecksum(filePath) {
    const client = await this._getClient();
    const results = await client.scroll(this._collection, {
      filter:       { must: [{ key: 'filePath', match: { value: filePath } }] },
      limit:        1,
      with_payload: ['checksum'],
    });
    return results.points[0]?.payload?.checksum ?? null;
  }

  async listAllFilePaths() {
    const client = await this._getClient();
    const allPaths = new Set();
    let offset = undefined;

    do {
      const scrollParams = {
        limit:        100,
        with_payload: true,
      };
      // Only include offset when paginating — passing null/undefined on first call
      // causes a 400 Bad Request from the Qdrant REST API.
      if (offset !== undefined) scrollParams.offset = offset;

      const res = await client.scroll(this._collection, scrollParams);
      for (const p of res.points) {
        if (p.payload?.filePath) allPaths.add(p.payload.filePath);
      }
      offset = res.next_page_offset ?? undefined;
    } while (offset !== undefined);

    return [...allPaths];
  }

  get size() { return -1; } // Not readily available without a scroll count
  get backendName() { return 'qdrant'; }
}

// ---------------------------------------------------------------------------
// Singleton — picks the right backend on first use
// ---------------------------------------------------------------------------

let _backend = null;

function getBackend() {
  if (_backend) return _backend;
  _backend = config.qdrantUrl
    ? new QdrantBackend()
    : new InMemoryBackend();
  return _backend;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create the Qdrant collection if it doesn't exist (no-op for in-memory).
 * Call once during AI Knowledge Service startup.
 */
export async function initialize() {
  await getBackend().initialize();
}

/**
 * Upsert one or more embedding records.
 *
 * @param {Array<{
 *   id:      string,
 *   vector:  number[],
 *   payload: {
 *     filePath:   string,
 *     chunkIndex: number,
 *     heading:    string|null,
 *     department: string,
 *     fileType:   string,
 *     content:    string,
 *     tokenCount: number,
 *     checksum:   string,
 *     indexedAt:  string
 *   }
 * }>} points
 */
export async function upsert(points) {
  await getBackend().upsert(points);
}

/**
 * Similarity search.
 *
 * @param {number[]} queryVector
 * @param {{
 *   topK?:       number,
 *   minScore?:   number,
 *   filter?:     { department?: string, fileType?: string }
 * }} [options]
 * @returns {Promise<Array<{ filePath, chunkIndex, heading, department, fileType, content, tokenCount, score }>>}
 */
export async function search(queryVector, options = {}) {
  const topK     = options.topK     ?? config.vdbTopK;
  const minScore = options.minScore ?? config.vdbMinScore;
  const filter   = options.filter   ?? {};
  return getBackend().search(queryVector, { topK, minScore, filter });
}

/**
 * Delete all stored chunks for a given file path.
 *
 * @param {string} filePath
 */
export async function deleteByFile(filePath) {
  await getBackend().deleteByFile(filePath);
}

/**
 * Retrieve the stored checksum for a file (null if not indexed).
 *
 * @param {string} filePath
 * @returns {Promise<string|null>}
 */
export async function getChecksum(filePath) {
  return getBackend().getChecksum(filePath);
}

/**
 * List all file paths currently in the vector database.
 * Used by the indexer to detect and clean up deleted files.
 *
 * @returns {Promise<string[]>}
 */
export async function listAllFilePaths() {
  return getBackend().listAllFilePaths();
}

/**
 * Return backend info for health reporting.
 * @returns {{ backend: string, size: number }}
 */
export function stats() {
  const b = getBackend();
  return { backend: b.backendName, size: b.size };
}

/**
 * Reset to a fresh backend — used in tests only.
 * @internal
 */
export function _resetForTesting() {
  _backend = null;
}
