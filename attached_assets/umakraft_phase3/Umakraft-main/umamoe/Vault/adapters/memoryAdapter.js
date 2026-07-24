/**
 * Vault — Memory Storage Adapter
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Department: Vault — Stage 1, Umamoe
 *
 * In-memory adapter for development and testing.
 * Replace with a database adapter in production.
 *
 * Implements the VaultStorageAdapter interface:
 *   store(trustedEnvelope)  → StorageResult
 *   retrieve(query)         → RetrieveResult
 *   update(id, patch)       → StorageResult
 *   delete(id)              → StorageResult
 */

const store = new Map();

/**
 * Store a trusted envelope.
 * @param {{ trustedData: object, metadata: object }} trustedEnvelope
 * @returns {{ success: boolean, id?: string, error?: string }}
 */
export async function storeData(trustedEnvelope) {
  try {
    const id = trustedEnvelope.trustedData?.id;
    if (!id) {
      return { success: false, error: 'VAULT_MISSING_ID', message: 'trustedData.id is required for storage' };
    }
    store.set(id, {
      data: trustedEnvelope.trustedData,
      metadata: trustedEnvelope.metadata,
      storedAt: new Date().toISOString(),
    });
    return { success: true, id };
  } catch (err) {
    return { success: false, error: 'VAULT_STORE_ERROR', message: err.message };
  }
}

/**
 * Retrieve stored data by query.
 * @param {{ id?: string }} query
 * @returns {{ success: boolean, data?: object, error?: string }}
 */
export async function retrieveData(query) {
  try {
    if (query?.id) {
      const record = store.get(query.id);
      if (!record) {
        return { success: false, error: 'VAULT_NOT_FOUND', message: `No record found for id=${query.id}` };
      }
      return { success: true, data: record };
    }

    // Return all records if no id specified
    return { success: true, data: Array.from(store.values()) };
  } catch (err) {
    return { success: false, error: 'VAULT_RETRIEVE_ERROR', message: err.message };
  }
}

/**
 * Update a stored record by id.
 * @param {string} id
 * @param {object} patch
 * @returns {{ success: boolean, error?: string }}
 */
export async function updateData(id, patch) {
  try {
    const existing = store.get(id);
    if (!existing) {
      return { success: false, error: 'VAULT_NOT_FOUND', message: `No record found for id=${id}` };
    }
    store.set(id, {
      ...existing,
      data: { ...existing.data, ...patch },
      updatedAt: new Date().toISOString(),
    });
    return { success: true, id };
  } catch (err) {
    return { success: false, error: 'VAULT_UPDATE_ERROR', message: err.message };
  }
}

/**
 * Delete a stored record by id.
 * @param {string} id
 * @returns {{ success: boolean, error?: string }}
 */
export async function deleteData(id) {
  try {
    if (!store.has(id)) {
      return { success: false, error: 'VAULT_NOT_FOUND', message: `No record found for id=${id}` };
    }
    store.delete(id);
    return { success: true, id };
  } catch (err) {
    return { success: false, error: 'VAULT_DELETE_ERROR', message: err.message };
  }
}
