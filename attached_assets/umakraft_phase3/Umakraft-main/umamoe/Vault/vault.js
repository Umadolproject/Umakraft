/**
 * Vault
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Vault — Stage 1, Umamoe
 *
 * Sole responsibility: store and retrieve Inspector-approved trusted data.
 * Uses a storage adapter pattern so the underlying store can be swapped
 * without rewriting pipeline logic.
 */

import { resolveStorageBackend } from '../../core/storageBackend.js';

let _adapterPromise = null;

async function getAdapter() {
  if (_adapterPromise) return _adapterPromise;

  const backend = resolveStorageBackend('vault');
  _adapterPromise = backend === 'sqlite'
    ? import('./adapters/sqliteAdapter.js')
    : import('./adapters/memoryAdapter.js');
  return _adapterPromise;
}

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'vault',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function vaultError(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

function isTrusted(inspectorResult) {
  return (
    inspectorResult !== null &&
    typeof inspectorResult === 'object' &&
    inspectorResult.success === true &&
    inspectorResult.accepted === true &&
    'data' in inspectorResult &&
    typeof inspectorResult.inspectedAt === 'string'
  );
}

export async function receive(inspectorResult) {
  if (!isTrusted(inspectorResult)) {
    log('error', 'VAULT_UNTRUSTED_INPUT: rejecting non-approved envelope');
    return vaultError(
      'VAULT_UNTRUSTED_INPUT',
      'Vault only accepts Inspector-approved envelopes (success: true, accepted: true)',
      { received: inspectorResult },
    );
  }

  const trustedEnvelope = {
    trustedData: inspectorResult.data,
    metadata: {
      source: 'Inspector',
      inspectedAt: inspectorResult.inspectedAt,
      receivedAt: new Date().toISOString(),
    },
  };

  const adapter = await getAdapter();
  const result = await adapter.storeData(trustedEnvelope);
  if (result.success) {
    log('info', `stored trusted data — id=${result.id}`);
  } else {
    log('error', `storage failed — ${result.error}: ${result.message}`);
  }
  return result;
}

export async function retrieve(query = {}) {
  const adapter = await getAdapter();
  const result = await adapter.retrieveData(query);
  if (!result.success) {
    log('warn', `retrieve failed — ${result.error}: ${result.message}`, query);
  }
  return result;
}

export async function update(id, patch) {
  if (!id || typeof patch !== 'object') {
    return vaultError('VAULT_INVALID_UPDATE', 'id and a patch object are required');
  }
  const adapter = await getAdapter();
  const result = await adapter.updateData(id, patch);
  if (!result.success) {
    log('warn', `update failed — ${result.error}: ${result.message}`, { id });
  }
  return result;
}

export async function remove(id) {
  if (!id) {
    return vaultError('VAULT_INVALID_DELETE', 'id is required for deletion');
  }
  const adapter = await getAdapter();
  const result = await adapter.deleteData(id);
  if (!result.success) {
    log('warn', `delete failed — ${result.error}: ${result.message}`, { id });
  }
  return result;
}
