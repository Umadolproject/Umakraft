// AI/managers/MemoryManager.js
// Memory Manager — stores and retrieves vectors via Qdrant.
//
// Wraps the Qdrant provider and adds convenience methods for the RAG pipeline:
//   - remember():  embed text → store in Qdrant
//   - recall():    embed query → semantic search → return payloads

import log from '../../core/log.js';
import { qdrant } from '../providers/memory/qdrantProvider.js';
import { embed as embedText } from './EmbeddingManager.js';
import config from '../Configuration.js';

const COLLECTION = config.qdrantCollection ?? 'umakraft';

/**
 * Store a document in memory (embed + upsert).
 *
 * @param {string} id      — unique document ID
 * @param {string} text    — content to embed
 * @param {object} payload — metadata to store alongside
 */
export async function remember(id, text, payload = {}) {
  const { vector } = await embedText(text);
  await qdrant.upsert(COLLECTION, vector, { ...payload, text, id }, id);
  log.debug(`[MemoryManager] Stored "${id}" (${text.length} chars)`);
}

/**
 * Semantic search across stored documents.
 *
 * @param {string} query
 * @param {number} [limit=5]
 * @returns {Promise<import('../providers/interfaces.js').MemorySearchResult[]>}
 */
export async function recall(query, limit = 5) {
  const { vector } = await embedText(query);
  return qdrant.search(COLLECTION, vector, limit);
}

/**
 * Remove a document from memory.
 * @param {string} id
 */
export async function forget(id) {
  await qdrant.delete(COLLECTION, id);
}
