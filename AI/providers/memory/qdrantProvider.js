// AI/providers/memory/qdrantProvider.js
// Qdrant vector database provider — implements MemoryProvider interface.
//
// API: REST at {url}/collections/{collection}/points
// Auth: api-key header
//
// Stores and retrieves vectors + payloads for RAG, memory, and semantic search.

import log from '../../../core/log.js';
import config from '../../Configuration.js';

const QDRANT_HEADERS = () => {
  const h = { 'Content-Type': 'application/json' };
  if (config.qdrantApiKey) h['api-key'] = config.qdrantApiKey;
  return h;
};

function endpoint(collection, ...parts) {
  const url = config.qdrantUrl?.replace(/\/$/, '') ?? 'http://localhost:6333';
  return `${url}/collections/${collection}/points${parts.length ? '/' + parts.join('/') : ''}`;
}

/**
 * Ensure a collection exists. Creates it if not found (idempotent).
 * @param {string} collection
 * @param {number} dim
 */
async function ensureCollection(collection, dim = config.vdbEmbeddingDim ?? 1024) {
  const res = await fetch(
    config.qdrantUrl?.replace(/\/$/, '') + '/collections/' + collection,
    { headers: QDRANT_HEADERS() },
  );

  if (res.ok) return; // exists

  // Create it
  const createRes = await fetch(
    config.qdrantUrl?.replace(/\/$/, '') + '/collections/' + collection,
    {
      method: 'PUT',
      headers: QDRANT_HEADERS(),
      body: JSON.stringify({
        vectors: { size: dim, distance: 'Cosine' },
      }),
    },
  );

  if (!createRes.ok) {
    const body = await createRes.text();
    // "already exists" is fine
    if (!body.includes('already exists')) {
      throw new Error(`Qdrant create collection failed: ${createRes.status} ${body}`);
    }
  }

  log.info(`[Qdrant] Created collection "${collection}" (dim=${dim})`);
}

/** @type {import('../interfaces.js').MemoryProvider} */
export const qdrant = {
  /**
   * Upsert a vector point.
   * @param {string} collection
   * @param {number[]} vector
   * @param {object} payload
   * @param {string} [id]
   */
  async upsert(collection, vector, payload, id) {
    await ensureCollection(collection);

    const pointId = id ?? payload?.id ?? crypto.randomUUID?.() ?? Date.now().toString();
    const res = await fetch(endpoint(collection) + '?wait=true', {
      method: 'PUT',
      headers: QDRANT_HEADERS(),
      body: JSON.stringify({
        points: [{ id: pointId, vector, payload }],
      }),
    });

    if (!res.ok) throw new Error(`Qdrant upsert failed: ${res.status} ${await res.text()}`);
  },

  /**
   * Search for similar vectors.
   * @param {string} collection
   * @param {number[]} vector
   * @param {number} [limit=5]
   * @returns {Promise<import('../interfaces.js').MemorySearchResult[]>}
   */
  async search(collection, vector, limit = 5) {
    await ensureCollection(collection);

    const res = await fetch(endpoint(collection, 'search'), {
      method: 'POST',
      headers: QDRANT_HEADERS(),
      body: JSON.stringify({
        vector,
        limit,
        with_payload: true,
      }),
    });

    if (!res.ok) throw new Error(`Qdrant search failed: ${res.status} ${await res.text()}`);

    const data = await res.json();
    return (data.result ?? []).map(r => ({
      id:      r.id,
      score:   r.score,
      payload: r.payload ?? {},
    }));
  },

  /**
   * Delete a point by ID.
   * @param {string} collection
   * @param {string} id
   */
  async delete(collection, id) {
    const res = await fetch(endpoint(collection, 'delete') + '?wait=true', {
      method: 'POST',
      headers: QDRANT_HEADERS(),
      body: JSON.stringify({ points: [id] }),
    });

    if (!res.ok) throw new Error(`Qdrant delete failed: ${res.status} ${await res.text()}`);
  },
};
