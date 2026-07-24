import { resolveSqlitePath } from '../../../core/storageBackend.js';
import { queryAll, queryOne, withRead, withWrite } from '../../../core/sqlite.js';

const dbPath = resolveSqlitePath('depot');
let _initPromise = null;

async function init() {
  if (_initPromise) return _initPromise;
  _initPromise = withWrite(dbPath, async (db) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS depot_products (
        id TEXT NOT NULL,
        version TEXT NOT NULL,
        compiled_product_json TEXT NOT NULL,
        provenance_json TEXT NOT NULL,
        stored_at TEXT NOT NULL,
        PRIMARY KEY (id, version)
      );
      CREATE INDEX IF NOT EXISTS idx_depot_id_version ON depot_products (id, version DESC);
    `);
    return { success: true };
  });
  return _initPromise;
}

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    version: row.version,
    compiledProduct: JSON.parse(row.compiled_product_json),
    provenance: JSON.parse(row.provenance_json),
    storedAt: row.stored_at,
  };
}

export async function put(product) {
  await init();
  try {
    const storedAt = new Date().toISOString();
    return withWrite(dbPath, async (db) => {
      db.run(
        `INSERT OR REPLACE INTO depot_products (id, version, compiled_product_json, provenance_json, stored_at)
         VALUES (?, ?, ?, ?, ?)`,
        [
          product.id,
          product.version,
          JSON.stringify(product.compiledProduct),
          JSON.stringify(product.provenance),
          storedAt,
        ],
      );
      return { success: true, storedAt };
    });
  } catch (err) {
    return { success: false, error: 'DEPOT_PUT_ERROR', message: err.message };
  }
}

export async function get(id, options = {}) {
  await init();
  try {
    return withRead(dbPath, async (db) => {
      const row = options.version
        ? queryOne(
            db,
            `SELECT id, version, compiled_product_json, provenance_json, stored_at
             FROM depot_products
             WHERE id = ? AND version = ?`,
            [id, options.version],
          )
        : queryOne(
            db,
            `SELECT id, version, compiled_product_json, provenance_json, stored_at
             FROM depot_products
             WHERE id = ?
             ORDER BY version DESC
             LIMIT 1`,
            [id],
          );
      return { product: hydrate(row) };
    });
  } catch (err) {
    return { product: null, error: 'DEPOT_GET_ERROR', message: err.message };
  }
}

export async function del(id, options = {}) {
  await init();
  try {
    return withWrite(dbPath, async (db) => {
      if (options.version) {
        const row = queryOne(db, `SELECT id FROM depot_products WHERE id = ? AND version = ?`, [id, options.version]);
        if (!row) return { success: false, error: 'DEPOT_NOT_FOUND' };
        db.run(`DELETE FROM depot_products WHERE id = ? AND version = ?`, [id, options.version]);
        return { success: true };
      }
      db.run(`DELETE FROM depot_products WHERE id = ?`, [id]);
      return { success: db.getRowsModified() > 0, deleted: db.getRowsModified() };
    });
  } catch (err) {
    return { success: false, error: 'DEPOT_DEL_ERROR', message: err.message };
  }
}

export async function query(filter = {}, options = {}) {
  await init();
  try {
    return withRead(dbPath, async (db) => {
      const where = [];
      const params = [];
      if (filter.id) {
        where.push('id = ?');
        params.push(filter.id);
      }
      if (filter.trend) {
        where.push(`json_extract(compiled_product_json, '$.trend') = ?`);
        params.push(filter.trend);
      }

      const limit = options.limit ?? 50;
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const rows = queryAll(
        db,
        `SELECT id, version, compiled_product_json, provenance_json, stored_at
         FROM depot_products
         ${whereSql}
         ORDER BY version DESC
         LIMIT ?`,
        [...params, limit + 1],
      );

      const hydrated = rows.map(hydrate);
      const page = hydrated.slice(0, limit);
      const nextCursor = hydrated.length > limit
        ? `${hydrated[limit - 1].id}:${hydrated[limit - 1].version}`
        : undefined;
      return { results: page, nextCursor };
    });
  } catch (err) {
    return { results: [], error: 'DEPOT_QUERY_ERROR', message: err.message };
  }
}
