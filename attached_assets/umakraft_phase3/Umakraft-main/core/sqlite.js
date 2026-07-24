// core/sqlite.js
// Shared SQLite runtime for the UmaKraft pipeline.
// Uses sql.js so the repo can persist a real SQLite database file without
// requiring a native driver at build time.

import initSqlJs from 'sql.js';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmDir = join(__dirname, '..', 'node_modules', 'sql.js', 'dist');

let _sqlPromise = null;
const _dbPromises = new Map();
const _writeQueues = new Map();

async function loadSql() {
  if (_sqlPromise) return _sqlPromise;
  _sqlPromise = initSqlJs({
    locateFile: file => join(wasmDir, file),
  });
  return _sqlPromise;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function getDatabase(dbPath) {
  if (_dbPromises.has(dbPath)) return _dbPromises.get(dbPath);

  const promise = (async () => {
    const SQL = await loadSql();
    if (await fileExists(dbPath)) {
      const data = await readFile(dbPath);
      return new SQL.Database(new Uint8Array(data));
    }
    return new SQL.Database();
  })();

  _dbPromises.set(dbPath, promise);
  return promise;
}

export async function persistDatabase(dbPath) {
  const db = await getDatabase(dbPath);
  const bytes = db.export();
  await mkdir(dirname(dbPath), { recursive: true });
  await writeFile(dbPath, Buffer.from(bytes));
}

export async function withRead(dbPath, fn) {
  const db = await getDatabase(dbPath);
  return fn(db);
}

export async function withWrite(dbPath, fn) {
  const previous = _writeQueues.get(dbPath) ?? Promise.resolve();
  const op = async () => {
    const db = await getDatabase(dbPath);
    const result = await fn(db);
    await persistDatabase(dbPath);
    return result;
  };

  const next = previous.then(op, op);
  _writeQueues.set(dbPath, next.catch(() => {}));
  return next;
}

export function queryAll(db, sql, params = []) {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

export function queryOne(db, sql, params = []) {
  const rows = queryAll(db, sql, params);
  return rows[0] ?? null;
}
