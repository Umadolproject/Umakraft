/**
 * Depot
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Depot — Stage 2, Refinery
 *
 * Sole responsibility: store and retrieve compiled products
 * produced by the Compiler. Uses an adapter pattern so the
 * underlying store can be swapped without rewriting pipeline logic.
 */

import { put, get, del, query } from './adapters/memoryAdapter.js';

// ─── Logging ─────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'depot',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function depotError(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Store a compiled product in the Depot.
 * Only accepts products that include id, version, compiledProduct, and provenance.
 *
 * @param {{ id, version, compiledProduct, provenance }} product
 * @returns {Promise<{ success: boolean, storedAt?: string, error?: string }>}
 */
export async function store(product) {
  if (!product?.id || !product?.version || !product?.compiledProduct || !product?.provenance) {
    log('error', 'DEPOT_INVALID_PRODUCT: missing required fields');
    return depotError(
      'DEPOT_INVALID_PRODUCT',
      'Product must include id, version, compiledProduct, and provenance'
    );
  }

  const result = await put(product);
  if (result.success) {
    log('info', `stored product id=${product.id} version=${product.version}`);
  } else {
    log('error', `store failed — ${result.error}: ${result.message}`);
  }
  return result;
}

/**
 * Retrieve a compiled product by id (latest version by default).
 *
 * @param {string} id
 * @param {{ version?: string }} [options]
 * @returns {Promise<{ product: object|null }>}
 */
export async function retrieve(id, options = {}) {
  if (!id) return depotError('DEPOT_MISSING_ID', 'id is required for retrieval');
  const result = await get(id, options);
  if (!result.product) {
    log('warn', `product not found id=${id}`, options);
  }
  return result;
}

/**
 * Delete a compiled product.
 *
 * @param {string} id
 * @param {{ version?: string }} [options]
 * @returns {Promise<{ success: boolean }>}
 */
export async function remove(id, options = {}) {
  if (!id) return depotError('DEPOT_MISSING_ID', 'id is required for deletion');
  const result = await del(id, options);
  if (!result.success) {
    log('warn', `delete failed id=${id}`, options);
  }
  return result;
}

/**
 * Query compiled products.
 *
 * @param {object} [filter]
 * @param {{ limit?: number, cursor?: string }} [options]
 * @returns {Promise<{ results: object[], nextCursor?: string }>}
 */
export async function search(filter = {}, options = {}) {
  return query(filter, options);
}
