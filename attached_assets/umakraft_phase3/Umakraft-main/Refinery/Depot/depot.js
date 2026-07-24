/**
 * Depot
 */

import { resolveStorageBackend } from '../../core/storageBackend.js';

let _adapterPromise = null;

async function getAdapter() {
  if (_adapterPromise) return _adapterPromise;
  const backend = resolveStorageBackend('depot');
  _adapterPromise = backend === 'sqlite'
    ? import('./adapters/sqliteAdapter.js')
    : import('./adapters/memoryAdapter.js');
  return _adapterPromise;
}

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'depot',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function depotError(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

export async function store(product) {
  if (!product?.id || !product?.version || !product?.compiledProduct || !product?.provenance) {
    log('error', 'DEPOT_INVALID_PRODUCT: missing required fields');
    return depotError('DEPOT_INVALID_PRODUCT', 'Product must include id, version, compiledProduct, and provenance');
  }

  const adapter = await getAdapter();
  const result = await adapter.put(product);
  if (result.success) {
    log('info', `stored product id=${product.id} version=${product.version}`);
  } else {
    log('error', `store failed — ${result.error}: ${result.message}`);
  }
  return result;
}

export async function retrieve(id, options = {}) {
  if (!id) return depotError('DEPOT_MISSING_ID', 'id is required for retrieval');
  const adapter = await getAdapter();
  const result = await adapter.get(id, options);
  if (!result.product) {
    log('warn', `product not found id=${id}`, options);
  }
  return result;
}

export async function remove(id, options = {}) {
  if (!id) return depotError('DEPOT_MISSING_ID', 'id is required for deletion');
  const adapter = await getAdapter();
  const result = await adapter.del(id, options);
  if (!result.success) {
    log('warn', `delete failed id=${id}`, options);
  }
  return result;
}

export async function search(filter = {}, options = {}) {
  const adapter = await getAdapter();
  return adapter.query(filter, options);
}
