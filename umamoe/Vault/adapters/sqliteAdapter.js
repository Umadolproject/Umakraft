import { resolveSqlitePath }                        from '../../../core/storageBackend.js';
import { queryOne, queryAll, withRead, withWrite }  from '../../../core/sqlite.js';
import { pipelineRuntime }                          from '../../../core/pipelineRuntime.js';

const dbPath = resolveSqlitePath('vault');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, async (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS vault_records (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        stored_at TEXT NOT NULL,
        updated_at TEXT
      );
      CREATE TABLE IF NOT EXISTS vault_snapshots (
        snapshot_id INTEGER PRIMARY KEY AUTOINCREMENT,
        id TEXT NOT NULL,
        data_json TEXT NOT NULL,
        metadata_json TEXT NOT NULL,
        stored_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vault_snapshots_id_stored_at
        ON vault_snapshots (id, stored_at DESC);
    `);
    return { success: true };
  });
  return _initPromise;
}

function hydrateRecord(row) {
  if (!row) return null;
  return {
    data: JSON.parse(row.data_json),
    metadata: {
      ...JSON.parse(row.metadata_json),
      storedAt:  row.stored_at,
      updatedAt: row.updated_at ?? undefined,
    },
    storedAt:  row.stored_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

// ─── Snapshot pruning (Phase 4) ───────────────────────────────────────────────

/**
 * Delete snapshots for `id` beyond the configured retain count.
 * Runs inside the same write transaction as the store/update that triggered it.
 *
 * @param {object} db   — sql.js Database (already open inside withWrite)
 * @param {string} id   — trainer ID
 */
function _pruneSnapshots(db, id) {
  const retain = pipelineRuntime.vaultSnapshotRetainCount;
  if (retain <= 0) return; // 0 = unlimited

  db.run(
    `DELETE FROM vault_snapshots
     WHERE id = ?
       AND snapshot_id NOT IN (
         SELECT snapshot_id
         FROM   vault_snapshots
         WHERE  id = ?
         ORDER  BY stored_at DESC
         LIMIT  ?
       )`,
    [id, id, retain],
  );
}

// ─── Public adapter API ───────────────────────────────────────────────────────

export async function storeData(trustedEnvelope) {
  await init();
  try {
    const id = trustedEnvelope.trustedData?.id;
    if (!id) {
      return { success: false, error: 'VAULT_MISSING_ID', message: 'trustedData.id is required for storage' };
    }

    const storedAt     = new Date().toISOString();
    const dataJson     = JSON.stringify(trustedEnvelope.trustedData);
    const metadataJson = JSON.stringify(trustedEnvelope.metadata ?? {});

    return withWrite(dbPath, async (db) => {
      db.run(
        `INSERT INTO vault_records (id, data_json, metadata_json, stored_at, updated_at)
         VALUES (?, ?, ?, ?, NULL)
         ON CONFLICT(id) DO UPDATE SET
           data_json     = excluded.data_json,
           metadata_json = excluded.metadata_json,
           stored_at     = excluded.stored_at,
           updated_at    = excluded.stored_at`,
        [id, dataJson, metadataJson, storedAt],
      );

      db.run(
        `INSERT INTO vault_snapshots (id, data_json, metadata_json, stored_at)
         VALUES (?, ?, ?, ?)`,
        [id, dataJson, metadataJson, storedAt],
      );

      // Phase 4: prune old snapshots beyond the retention limit
      _pruneSnapshots(db, id);

      return { success: true, id, storedAt };
    });
  } catch (err) {
    return { success: false, error: 'VAULT_STORE_ERROR', message: err.message };
  }
}

export async function retrieveData(query = {}) {
  await init();
  try {
    return withRead(dbPath, async (db) => {
      if (query?.id) {
        const row = query.version === 'previous'
          ? queryOne(
              db,
              `SELECT data_json, metadata_json, stored_at, NULL AS updated_at
               FROM vault_snapshots
               WHERE id = ?
               ORDER BY stored_at DESC
               LIMIT 1 OFFSET 1`,
              [query.id],
            )
          : queryOne(
              db,
              `SELECT data_json, metadata_json, stored_at, updated_at
               FROM vault_records
               WHERE id = ?`,
              [query.id],
            );

        if (!row) {
          return { success: false, error: 'VAULT_NOT_FOUND', message: `No record found for id=${query.id}` };
        }
        return { success: true, data: hydrateRecord(row) };
      }

      const rows = queryAll(
        db,
        `SELECT data_json, metadata_json, stored_at, updated_at
         FROM vault_records
         ORDER BY stored_at DESC`,
      );
      return { success: true, data: rows.map(hydrateRecord) };
    });
  } catch (err) {
    return { success: false, error: 'VAULT_RETRIEVE_ERROR', message: err.message };
  }
}

export async function updateData(id, patch) {
  await init();
  try {
    return withWrite(dbPath, async (db) => {
      const existing = queryOne(
        db,
        `SELECT data_json, metadata_json, stored_at, updated_at FROM vault_records WHERE id = ?`,
        [id],
      );
      if (!existing) {
        return { success: false, error: 'VAULT_NOT_FOUND', message: `No record found for id=${id}` };
      }

      const data      = { ...JSON.parse(existing.data_json), ...patch };
      const updatedAt = new Date().toISOString();
      db.run(
        `UPDATE vault_records SET data_json = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(data), updatedAt, id],
      );
      db.run(
        `INSERT INTO vault_snapshots (id, data_json, metadata_json, stored_at)
         VALUES (?, ?, ?, ?)`,
        [id, JSON.stringify(data), existing.metadata_json, updatedAt],
      );

      // Phase 4: prune after update as well
      _pruneSnapshots(db, id);

      return { success: true, id, updatedAt };
    });
  } catch (err) {
    return { success: false, error: 'VAULT_UPDATE_ERROR', message: err.message };
  }
}

export async function deleteData(id) {
  await init();
  try {
    return withWrite(dbPath, async (db) => {
      const existing = queryOne(db, `SELECT id FROM vault_records WHERE id = ?`, [id]);
      if (!existing) {
        return { success: false, error: 'VAULT_NOT_FOUND', message: `No record found for id=${id}` };
      }
      db.run(`DELETE FROM vault_records  WHERE id = ?`, [id]);
      db.run(`DELETE FROM vault_snapshots WHERE id = ?`, [id]);
      return { success: true, id };
    });
  } catch (err) {
    return { success: false, error: 'VAULT_DELETE_ERROR', message: err.message };
  }
}
