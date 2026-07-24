// core/sqlite.js
// Shared SQLite runtime for the UmaKraft pipeline.
// Uses sql.js so the repo can persist a real SQLite database file without
// requiring a native driver at build time.
//
// Phase 4: Dirty-flag deferred flush.
// DB mutations are still serialised through a per-path write queue, but the
// expensive disk-write is now deferred and batched.  A periodic timer
// (UMAKRAFT_SQLITE_FLUSH_MS, default 5 000 ms) flushes all dirty DBs, and a
// synchronous `process.on('exit')` handler ensures nothing is lost on shutdown
// (Discord's signal handlers call process.exit, which triggers 'exit').

import initSqlJs from 'sql.js';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync }            from 'node:fs';
import { dirname, join }                       from 'node:path';
import { fileURLToPath }                       from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmDir   = join(__dirname, '..', 'node_modules', 'sql.js', 'dist');

const FLUSH_INTERVAL_MS = Number.parseInt(
  process.env.UMAKRAFT_SQLITE_FLUSH_MS ?? '5000',
  10,
);

// ─── Shared state ─────────────────────────────────────────────────────────────

let _sqlPromise = null;
const _dbPromises  = new Map(); // dbPath -> Promise<Database>
const _writeQueues = new Map(); // dbPath -> Promise (write serialisation)
const _dirty       = new Set(); // dbPaths that need flushing to disk
const _dbs         = new Map(); // dbPath -> resolved Database (for sync flush)

// ─── SQL.js initialisation ────────────────────────────────────────────────────

async function loadSql() {
  if (_sqlPromise) return _sqlPromise;
  _sqlPromise = initSqlJs({ locateFile: file => join(wasmDir, file) });
  return _sqlPromise;
}

// ─── File helpers ─────────────────────────────────────────────────────────────

async function fileExists(path) {
  try { await access(path); return true; } catch { return false; }
}

// ─── Database access ──────────────────────────────────────────────────────────

export async function getDatabase(dbPath) {
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

// ─── Async persist ────────────────────────────────────────────────────────────

export async function persistDatabase(dbPath) {
  const db    = await getDatabase(dbPath);
  const bytes = db.export();
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, Buffer.from(bytes));
  _dirty.delete(dbPath);
}

// ─── Sync persist (exit handler only) ────────────────────────────────────────

function _persistSync(dbPath) {
  const db = _dbs.get(dbPath);
  if (!db) return;
  try {
    const bytes = db.export();
    mkdirSync(dirname(dbPath), { recursive: true });
    writeFileSync(dbPath, Buffer.from(bytes));
  } catch {
    // best-effort on process exit
  }
}

// ─── Public read/write helpers ────────────────────────────────────────────────

export async function withRead(dbPath, fn) {
  const db = await getDatabase(dbPath);
  return fn(db);
}

/**
 * Serialised write — mutations are queued so concurrent callers never
 * corrupt the in-memory DB.  After each mutation the path is marked dirty;
 * the deferred flush timer (or shutdown handler) writes it to disk.
 */
export async function withWrite(dbPath, fn) {
  const previous = _writeQueues.get(dbPath) ?? Promise.resolve();

  const op = async () => {
    const db     = await getDatabase(dbPath);
    const result = await fn(db);
    _dirty.add(dbPath);          // mark for deferred flush
    return result;
  };

  // Chain onto the previous write, but do NOT let a prior rejection masquerade
  // as success for this caller. Swallow the prior error for chaining only; the
  // caller of this op still sees its own op's result via `next`.
  const next = previous.catch(() => {}).then(op);
  _writeQueues.set(dbPath, next.catch(() => {}));
  return next;
}

// ─── Deferred flush timer ─────────────────────────────────────────────────────

const _flushTimer = setInterval(async () => {
  for (const dbPath of [..._dirty]) {
    try {
      await persistDatabase(dbPath);
    } catch {
      // Will retry on next tick; log is omitted to avoid noise
    }
  }
}, FLUSH_INTERVAL_MS);

// Do not keep the Node process alive purely for the flush timer
if (typeof _flushTimer.unref === 'function') _flushTimer.unref();

// ─── Shutdown flush ───────────────────────────────────────────────────────────

/**
 * Force an immediate async flush of all dirty DBs.
 * Call before intentional shutdown or at the end of integration tests.
 */
export async function flushAll() {
  await Promise.all([..._dirty].map(p => persistDatabase(p)));
}

// Synchronous safety net — runs when process.exit() is called (including from
// Discord's SIGTERM/SIGINT handlers which call process.exit(0)).
process.on('exit', () => {
  for (const dbPath of _dirty) _persistSync(dbPath);
});

// ─── Query helpers ────────────────────────────────────────────────────────────

export function queryAll(db, sql, params = []) {
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

export function queryOne(db, sql, params = []) {
  return queryAll(db, sql, params)[0] ?? null;
}
