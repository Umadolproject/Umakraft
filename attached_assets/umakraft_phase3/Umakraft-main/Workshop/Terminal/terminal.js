/**
 * Terminal
 */

import { resolveStorageBackend } from '../../core/storageBackend.js';

let _adapterPromise = null;

async function getAdapter() {
  if (_adapterPromise) return _adapterPromise;
  const backend = resolveStorageBackend('terminal');
  _adapterPromise = backend === 'sqlite'
    ? import('./adapters/sqliteAdapter.js')
    : import('./adapters/memoryAdapter.js');
  return _adapterPromise;
}

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'terminal',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn') console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function terminalError(error, message, context = {}) {
  return { success: false, error, message, timestamp: new Date().toISOString(), context };
}

function generateTerminalId(blueprintKey) {
  return `terminal-${blueprintKey}-${Date.now()}`;
}

export async function receive(approvedDeliverable) {
  if (!approvedDeliverable?.approved) {
    log('error', 'TERMINAL_INVALID_INPUT — envelope not approved by Validator', {
      success: approvedDeliverable?.success,
      approved: approvedDeliverable?.approved,
    });
    return terminalError(
      'TERMINAL_INVALID_INPUT',
      'Deliverable must carry approved: true from the Validator before entering the Terminal',
      { received: { success: approvedDeliverable?.success, approved: approvedDeliverable?.approved } },
    );
  }

  const terminalId = generateTerminalId(approvedDeliverable.blueprintKey);
  const receivedAt = new Date().toISOString();

  const record = {
    terminalId,
    blueprintKey: approvedDeliverable.blueprintKey,
    blueprintName: approvedDeliverable.blueprintName,
    trigger: approvedDeliverable.trigger,
    type: approvedDeliverable.type,
    png: approvedDeliverable.png,
    meta: approvedDeliverable.meta,
    validatedAt: approvedDeliverable.validatedAt,
    fabricatorVersion: approvedDeliverable.fabricatorVersion,
    receivedAt,
    state: 'pending',
    claimedAt: null,
  };

  const adapter = await getAdapter();
  const result = await adapter.put(record);
  if (!result.success) {
    log('error', `TERMINAL_STORE_FAILURE — ${result.error}: ${result.message}`, { terminalId });
    return terminalError('TERMINAL_STORE_FAILURE', result.message, { terminalId });
  }

  log('info', `stored — terminalId=${terminalId} blueprintKey=${approvedDeliverable.blueprintKey}`);
  return { success: true, terminalId, receivedAt };
}

export async function pickup(terminalId) {
  if (!terminalId) {
    return terminalError('TERMINAL_INVALID_INPUT', 'terminalId is required for pickup');
  }

  const adapter = await getAdapter();
  const { record } = await adapter.get(terminalId);

  if (!record) {
    log('warn', `TERMINAL_NOT_FOUND — terminalId=${terminalId}`);
    return terminalError('TERMINAL_NOT_FOUND', `No deliverable found for terminalId=${terminalId}`, { terminalId });
  }

  if (record.state === 'claimed') {
    log('warn', `TERMINAL_ALREADY_CLAIMED — terminalId=${terminalId} claimedAt=${record.claimedAt}`);
    return terminalError(
      'TERMINAL_ALREADY_CLAIMED',
      `Deliverable terminalId=${terminalId} was already claimed at ${record.claimedAt}`,
      { terminalId, claimedAt: record.claimedAt },
    );
  }

  const claimedAt = new Date().toISOString();
  const claimedRecord = { ...record, state: 'claimed', claimedAt };

  const updateResult = await adapter.put(claimedRecord);
  if (!updateResult.success) {
    log('error', `TERMINAL_STORE_FAILURE — failed to mark claimed: ${updateResult.message}`, { terminalId });
    return terminalError('TERMINAL_STORE_FAILURE', updateResult.message, { terminalId });
  }

  log('info', `claimed — terminalId=${terminalId}`);
  return { success: true, terminalId, deliverable: claimedRecord };
}

export async function listReady(filter = {}) {
  const adapter = await getAdapter();
  return adapter.list({ ...filter, state: 'pending' });
}

export async function getReleaseMetadata(terminalId) {
  if (!terminalId) {
    return terminalError('TERMINAL_INVALID_INPUT', 'terminalId is required');
  }

  const adapter = await getAdapter();
  const { record } = await adapter.get(terminalId);

  if (!record) {
    log('warn', `TERMINAL_NOT_FOUND — terminalId=${terminalId}`);
    return terminalError('TERMINAL_NOT_FOUND', `No deliverable found for terminalId=${terminalId}`, { terminalId });
  }

  const { png: _png, ...metadata } = record;
  return { success: true, ...metadata };
}
