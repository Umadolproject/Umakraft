/**
 * Depot — Memory Storage Adapter
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Depot — Stage 2, Refinery
 *
 * In-memory adapter for development and testing.
 * Implements the Depot adapter contract (put / get / del / query).
 * Replace with a database adapter in production.
 */

// key: `${id}:${version}`, value: product
const store = new Map();

/**
 * Store a compiled product.
 * Idempotent for the same id+version.
 *
 * @param {{ id, version, compiledProduct, provenance }} product
 * @returns {{ success: boolean, storedAt?: string, error?: string }}
 */
export async function put(product) {
  try {
    if (!product?.id || !product?.version) {
      return { success: false, error: 'DEPOT_MISSING_KEY', message: 'product must have id and version' };
    }
    const key = `${product.id}:${product.version}`;
    store.set(key, { ...product, storedAt: new Date().toISOString() });
    return { success: true, storedAt: new Date().toISOString() };
  } catch (err) {
    return { success: false, error: 'DEPOT_PUT_ERROR', message: err.message };
  }
}

/**
 * Retrieve the latest product by id, or a specific version.
 *
 * @param {string} id
 * @param {{ version?: string }} [options]
 * @returns {{ product: object|null }}
 */
export async function get(id, options = {}) {
  try {
    if (options.version) {
      return { product: store.get(`${id}:${options.version}`) ?? null };
    }

    // Return latest by version (lexicographic ISO timestamp sort)
    const entries = Array.from(store.values()).filter((p) => p.id === id);
    if (!entries.length) return { product: null };
    entries.sort((a, b) => (a.version > b.version ? -1 : 1));
    return { product: entries[0] };
  } catch (err) {
    return { product: null, error: 'DEPOT_GET_ERROR', message: err.message };
  }
}

/**
 * Delete a product by id, optionally a specific version.
 *
 * @param {string} id
 * @param {{ version?: string }} [options]
 * @returns {{ success: boolean }}
 */
export async function del(id, options = {}) {
  try {
    if (options.version) {
      const key = `${id}:${options.version}`;
      if (!store.has(key)) return { success: false, error: 'DEPOT_NOT_FOUND' };
      store.delete(key);
      return { success: true };
    }

    // Delete all versions of this id
    let deleted = 0;
    for (const key of store.keys()) {
      if (key.startsWith(`${id}:`)) { store.delete(key); deleted++; }
    }
    return { success: deleted > 0, deleted };
  } catch (err) {
    return { success: false, error: 'DEPOT_DEL_ERROR', message: err.message };
  }
}

/**
 * Query products by filter with optional pagination.
 *
 * @param {object} filter  — e.g. { id, trend }
 * @param {{ limit?: number, cursor?: string }} [options]
 * @returns {{ results: object[], nextCursor?: string }}
 */
export async function query(filter = {}, options = {}) {
  try {
    let results = Array.from(store.values());

    if (filter.id)    results = results.filter((p) => p.id === filter.id);
    if (filter.trend) results = results.filter((p) => p.compiledProduct?.trend === filter.trend);

    // Sort latest first
    results.sort((a, b) => (a.version > b.version ? -1 : 1));

    const limit = options.limit ?? 50;
    const cursorIdx = options.cursor ? results.findIndex((p) => `${p.id}:${p.version}` === options.cursor) + 1 : 0;
    const page = results.slice(cursorIdx, cursorIdx + limit);
    const nextCursor = page.length === limit && cursorIdx + limit < results.length
      ? `${page[page.length - 1].id}:${page[page.length - 1].version}`
      : undefined;

    return { results: page, nextCursor };
  } catch (err) {
    return { results: [], error: 'DEPOT_QUERY_ERROR', message: err.message };
  }
}
