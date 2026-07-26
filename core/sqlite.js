// core/sqlite.js
// Unified SQLite adapter: sql.js (local/test) or Turso libSQL (production).
//
// Set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in Railway Variables to enable
// cloud persistence. Without them, sql.js writes to a local file as before.
//
// All adapters receive a DbWrapper via withRead / withWrite:
//   await db.run(sql, params)        — execute DML/DDL
//   db.getRowsModified()             — rows affected by the last run()
//   await queryAll(db, sql, params)  — SELECT → plain-object array
//   await queryOne(db, sql, params)  — SELECT → first row or null

import initSqlJs from 'sql.js';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync }            from 'node:fs';
import { dirname, join }                       from 'node:path';
import { fileURLToPath }                       from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmDir   = join(__dirname, '..', 'node_modules', 'sql.js', 'dist');

// ─── Backend detection ────────────────────────────────────────────────────────

const TURSO_URL   = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN ?? '';
const USE_TURSO   = Boolean(TURSO_URL);

// ─── DbWrapper ────────────────────────────────────────────────────────────────
// Uniform interface passed into withRead / withWrite callbacks.

class DbWrapper {
  constructor(impl) {
    this._impl = impl; // { kind: 'sqljs', db } | { kind: 'libsql', client }
    this._rowsModified = 0;
  }

  async run(sql, params = []) {
    if (this._impl.kind === 'sqljs') {
      this._impl.db.run(sql, params);
      this._rowsModified = this._impl.db.getRowsModified();
    } else {
      const result = await this._impl.client.execute({ sql, args: params });
      this._rowsModified = Number(result.rowsAffected ?? 0);
    }
  }

  getRowsModified() {
    return this._rowsModified;
  }
}

// ─── sql.js backend ───────────────────────────────────────────────────────────

let _sqlPromise = null;
const _dbPromises  = new Map(); // dbPath → Promise<sql.js Database>
const _writeQueues = new Map(); // dbPath → Promise (write serialisation)
const _dirty       = new Set(); // dbPaths pending disk flush
const _dbs         = new Map(); // dbPath → resolved sql.js Database

const FLUSH_INTERVAL_MS = Number.parseInt(
  process.env.UMAKRAFT_SQLITE_FLUSH_MS ?? '5000', 10,
);

async function loadSql() {
  if (_sqlPromise) return _sqlPromise;
  _sqlPromise = initSqlJs({ locateFile: file => join(wasmDir, file) });
  return _sqlPromise;
}

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

async function getSqlJsDatabase(dbPath) {
  if (_dbPromises.has(dbPath)) return _dbPromises.get(dbPath);
  const promise = (async () => {
    const SQL = await loadSql();
    let db;
    if (await fileExists(dbPath)) {
      const data = await readFile(dbPath);
      db = new SQL.Database(new Uint8Array(data));
    } else {
      db = new SQL.Database();
    }
    _dbs.set(dbPath, db);
    return db;
  })();
  _dbPromises.set(dbPath, promise);
  return promise;
}

async function persistSqlJsDatabase(dbPath) {
  const db    = await getSqlJsDatabase(dbPath);
  const bytes = db.export();
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, Buffer.from(bytes));
  _dirty.delete(dbPath);
}

function _persistSqlJsSync(dbPath) {
  const db = _dbs.get(dbPath);
  if (!db) return;
  try {
    const bytes = db.export();
    mkdirSync(dirname(dbPath), { recursive: true });
    writeFileSync(dbPath, Buffer.from(bytes));
  } catch { /* best-effort on process exit */ }
}

// ─── libSQL / Turso backend ───────────────────────────────────────────────────

let _libsqlClient = null;

async function getLibSqlClient() {
  if (_libsqlClient) return _libsqlClient;
  const { createClient } = await import('@libsql/client');
  _libsqlClient = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
  return _libsqlClient;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function withRead(dbPath, fn) {
  if (USE_TURSO) {
    const client = await getLibSqlClient();
    return fn(new DbWrapper({ kind: 'libsql', client }));
  }
  const db = await getSqlJsDatabase(dbPath);
  return fn(new DbWrapper({ kind: 'sqljs', db }));
}

export async function withWrite(dbPath, fn) {
  if (USE_TURSO) {
    // Turso handles concurrency server-side; no per-path queue needed.
    const client = await getLibSqlClient();
    return fn(new DbWrapper({ kind: 'libsql', client }));
  }

  // sql.js: serialise mutations per dbPath to avoid in-memory corruption.
  const previous = _writeQueues.get(dbPath) ?? Promise.resolve();
  const op = async () => {
    const db     = await getSqlJsDatabase(dbPath);
    const result = await fn(new DbWrapper({ kind: 'sqljs', db }));
    _dirty.add(dbPath);
    return result;
  };
  const next = previous.catch((err) => {
    console.error(`[sqlite] Write queue: previous operation failed for ${dbPath}: ${err.message}`);
  }).then(op);
  _writeQueues.set(dbPath, next.catch((err) => {
    console.error(`[sqlite] Write queue: operation failed for ${dbPath}: ${err.message}`);
  }));
  return next;
}

/**
 * Async SELECT — returns array of plain row objects (BigInt → Number).
 */
export async function queryAll(dbWrapper, sql, params = []) {
  if (dbWrapper._impl.kind === 'sqljs') {
    const db   = dbWrapper._impl.db;
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      return rows;
    } finally {
      stmt.free();
    }
  }
  // libSQL path
  const result = await dbWrapper._impl.client.execute({ sql, args: params });
  return result.rows.map(row => {
    const obj = {};
    for (const col of result.columns) {
      const val = row[col];
      obj[col] = typeof val === 'bigint' ? Number(val) : val;
    }
    return obj;
  });
}

/**
 * Async SELECT — returns first row or null.
 */
export async function queryOne(dbWrapper, sql, params = []) {
  const rows = await queryAll(dbWrapper, sql, params);
  return rows[0] ?? null;
}

/**
 * Flush a single sql.js database to disk immediately.
 * No-op when using Turso (writes already persisted in cloud).
 */
export async function persistDatabase(dbPath) {
  if (USE_TURSO) return;
  await persistSqlJsDatabase(dbPath);
}

/**
 * Flush all dirty sql.js databases. No-op for Turso.
 */
export async function flushAll() {
  if (USE_TURSO) return;
  await Promise.all([..._dirty].map(p => persistSqlJsDatabase(p)));
}

// Backward-compat export (used by a few tests that call getDatabase directly)
export { getSqlJsDatabase as getDatabase };

// ─── sql.js flush timer + shutdown handler (skipped in Turso mode) ────────────

if (!USE_TURSO) {
  const _flushTimer = setInterval(async () => {
    for (const dbPath of [..._dirty]) {
      try { await persistSqlJsDatabase(dbPath); } catch { /* retry next tick */ }
    }
  }, FLUSH_INTERVAL_MS);

  if (typeof _flushTimer.unref === 'function') _flushTimer.unref();

  process.on('exit', () => {
    for (const dbPath of _dirty) _persistSqlJsSync(dbPath);
  });
}
