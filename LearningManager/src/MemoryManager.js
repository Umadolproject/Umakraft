// AI/managers/MemoryManager.js
// Memory Manager — stores and retrieves cognitive memories, conversations, and cached responses.
//
// Uses the same storage backend as the rest of Umakraft via core/sqlite.js:
//   • TURSO_DATABASE_URL set → Turso / libSQL (cloud)
//   • Not set                 → sql.js WASM (local /data/umakraft.sqlite)
//
// This eliminates the dual @libsql/client import — all persistence flows
// through core/sqlite.js's withRead / withWrite wrappers. No in-memory Map
// fallback: sql.js already runs in WASM memory with periodic disk flushes.
//
// Public API:
//   store(entry)               → store a cognitive memory
//   get(id)                    → fetch by id
//   update(id, fields)         → patch a memory
//   delete(id)                 → remove a memory
//   getRecent(userId, limit, guildId) → recent memories for a user
//   search(userId, query, opts)→ keyword search
//   count(userId, tier, guildId)→ count matching filters
//   getByTier(tier, opts)      → filter by tier
//   storeConversation({...})   → store a conversation turn
//   getConversations(uId, chId)→ recent conversation turns
//   clearConversations(uId,chId)→ delete conversation history
//   getCachedResponse(key)     → lookup a cached AI response
//   setCachedResponse(key, resp)→ store a cached AI response
//   stats()                    → { backend, size, ... }

import { withRead, withWrite, queryAll, queryOne } from '../../core/sqlite.js';

const DB_PATH = '/data/umakraft.sqlite'; // shared database with core bot tables

// ══════════════════════════════════════════════════════════════════════════
// SQL column mapping (snake_case DB ↔ camelCase JS)
// ══════════════════════════════════════════════════════════════════════════

const COLUMN_MAP = {
  user_id:          'userId',
  guild_id:         'guildId',
  decay_rate:       'decayRate',
  access_count:     'accessCount',
  created_at:       'createdAt',
  updated_at:       'updatedAt',
  last_accessed_at: 'lastAccessedAt',
  expires_at:       'expiresAt',
};

function dbRowToMem(row) {
  const mem = { ...row };
  for (const [dbCol, jsKey] of Object.entries(COLUMN_MAP)) {
    if (dbCol in mem) { mem[jsKey] = mem[dbCol]; delete mem[dbCol]; }
  }
  if (typeof mem.importance === 'string') mem.importance = Number(mem.importance);
  if (typeof mem.confidence === 'string') mem.confidence = Number(mem.confidence);
  if (typeof mem.value === 'string') mem.value = Number(mem.value);
  if (typeof mem.decayRate === 'string') mem.decayRate = Number(mem.decayRate);
  if (typeof mem.accessCount === 'string') mem.accessCount = Number(mem.accessCount);
  if (typeof mem.protected === 'string') mem.protected = Number(mem.protected);
  return mem;
}

// ══════════════════════════════════════════════════════════════════════════
// CREATE TABLE DDL
// ══════════════════════════════════════════════════════════════════════════

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS memories (
    id               TEXT PRIMARY KEY,
    user_id          TEXT NOT NULL,
    guild_id         TEXT NOT NULL DEFAULT '',
    tier             TEXT NOT NULL DEFAULT 'short_term',
    type             TEXT NOT NULL DEFAULT 'fact',
    content          TEXT NOT NULL,
    summary          TEXT,
    importance       REAL DEFAULT 0.5,
    confidence       REAL DEFAULT 0.5,
    value            REAL DEFAULT 0.5,
    decay_rate       REAL DEFAULT 0.231,
    access_count     INTEGER DEFAULT 0,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    last_accessed_at TEXT,
    expires_at       TEXT,
    protected        INTEGER DEFAULT 0,
    source           TEXT,
    metadata         TEXT
  )
`;

const CREATE_CONVERSATIONS_SQL = `
  CREATE TABLE IF NOT EXISTS conversations (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    guild_id    TEXT NOT NULL DEFAULT '',
    channel_id  TEXT NOT NULL,
    query       TEXT NOT NULL,
    response    TEXT NOT NULL,
    recorded_at TEXT NOT NULL
  )
`;

const CREATE_RESPONSE_CACHE_SQL = `
  CREATE TABLE IF NOT EXISTS response_cache (
    cache_key      TEXT PRIMARY KEY,
    query          TEXT,
    classification TEXT,
    response_text  TEXT NOT NULL,
    citations      TEXT,
    model          TEXT DEFAULT 'unknown',
    tokens         INTEGER DEFAULT 0,
    stored_at      TEXT NOT NULL
  )
`;

const INDEXES_SQL = [
  `CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_guild ON memories(guild_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_tier ON memories(user_id, tier)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_value ON memories(user_id, value DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_user_ch ON conversations(user_id, channel_id, recorded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_conv_guild ON conversations(guild_id, recorded_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_cache_stored ON response_cache(stored_at)`,
];

// ══════════════════════════════════════════════════════════════════════════
// MemoryManager class
// ══════════════════════════════════════════════════════════════════════════

const USE_TURSO = Boolean(process.env.TURSO_DATABASE_URL);

export class MemoryManager {
  constructor(opts = {}) {
    this._dbPath = opts.dbPath ?? DB_PATH;
    this._ready  = false;
  }

  // ── init() — create schema + run migrations ────────────────────────────────
  async init() {
    if (this._ready) return this;

    await withWrite(this._dbPath, async (db) => {
      await db.run(CREATE_TABLE_SQL);
      await db.run(CREATE_CONVERSATIONS_SQL);
      await db.run(CREATE_RESPONSE_CACHE_SQL);
      for (const idxSql of INDEXES_SQL) {
        try { await db.run(idxSql); } catch { /* index may already exist */ }
      }
      // Migration: add guild_id to pre-existing tables
      for (const { table, col } of [
        { table: 'memories', col: "guild_id TEXT NOT NULL DEFAULT ''" },
        { table: 'conversations', col: "guild_id TEXT NOT NULL DEFAULT ''" },
      ]) {
        try { await db.run(`ALTER TABLE ${table} ADD COLUMN ${col}`); }
        catch { /* column already exists */ }
      }
    });

    // Verify
    const memCount  = await this.count();
    const convCount = await this._convCount();
    const cacheCount = await this._cacheCount();
    console.log(
      `[MemoryManager] Initialized (${USE_TURSO ? 'Turso' : 'sql.js'}) — ` +
      `${memCount} memories, ${convCount} conversations, ${cacheCount} cached responses`
    );

    this._ready = true;
    return this;
  }

  _ensureReady() {
    if (!this._ready) throw new Error('MemoryManager not initialized — call await init() first');
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Cognitive Memory CRUD
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Store a cognitive memory entry.
   * @param {Object} entry — { userId, guildId?, tier?, type?, content, importance?, confidence?, ... }
   * @returns {Promise<Object>} the stored memory
   */
  async store(entry) {
    this._ensureReady();
    const now = new Date().toISOString();
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const memory = {
      id, userId: entry.userId ?? 'unknown',
      guildId: entry.guildId ?? '', tier: entry.tier ?? 'short_term',
      type: entry.type ?? 'fact', content: entry.content ?? '',
      summary: entry.summary ?? null,
      importance: entry.importance ?? entry.value ?? 0.5,
      confidence: entry.confidence ?? 0.5,
      value: entry.value ?? entry.importance ?? 0.5,
      decayRate: entry.decayRate ?? 0.231,
      accessCount: entry.accessCount ?? 0,
      createdAt: now, updatedAt: now,
      lastAccessedAt: null, expiresAt: entry.expiresAt ?? null,
      protected: entry.protected ? 1 : 0,
      source: entry.source ?? null,
      metadata: typeof entry.metadata === 'string' ? entry.metadata : JSON.stringify(entry.metadata ?? null),
    };

    await withWrite(this._dbPath, async (db) => {
      await db.run(
        `INSERT INTO memories (id, user_id, guild_id, tier, type, content, summary,
          importance, confidence, value, decay_rate, access_count,
          created_at, updated_at, last_accessed_at, expires_at, protected, source, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [memory.id, memory.userId, memory.guildId, memory.tier, memory.type,
         memory.content, memory.summary, memory.importance, memory.confidence, memory.value,
         memory.decayRate, memory.accessCount, memory.createdAt, memory.updatedAt,
         memory.lastAccessedAt, memory.expiresAt, memory.protected, memory.source, memory.metadata],
      );
    });

    return memory;
  }

  /**
   * Fetch a single memory by id.
   */
  async get(id) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      // Increment access count on read
      await db.run(`UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`,
        [new Date().toISOString(), id]);
      const row = await queryOne(db, 'SELECT * FROM memories WHERE id = ?', [id]);
      return row ? dbRowToMem(row) : null;
    });
  }

  /**
   * Update specific fields of a memory.
   */
  async update(id, fields) {
    this._ensureReady();
    return withWrite(this._dbPath, async (db) => {
      const existing = await queryOne(db, 'SELECT * FROM memories WHERE id = ?', [id]);
      if (!existing) return null;
      const merged = { ...dbRowToMem(existing), ...fields, updatedAt: new Date().toISOString() };

      await db.run(
        `UPDATE memories SET
          user_id = ?, guild_id = ?, tier = ?, type = ?, content = ?, summary = ?,
          importance = ?, confidence = ?, value = ?, decay_rate = ?,
          access_count = ?, updated_at = ?, last_accessed_at = ?,
          expires_at = ?, protected = ?, source = ?, metadata = ?
        WHERE id = ?`,
        [merged.userId, merged.guildId, merged.tier, merged.type, merged.content,
         merged.summary, merged.importance, merged.confidence, merged.value,
         merged.decayRate, merged.accessCount ?? 0, merged.updatedAt,
         merged.lastAccessedAt, merged.expiresAt, merged.protected ? 1 : 0,
         merged.source, merged.metadata, id],
      );

      return merged;
    });
  }

  /**
   * Delete a memory by id.
   */
  async delete(id) {
    this._ensureReady();
    return withWrite(this._dbPath, async (db) => {
      await db.run('DELETE FROM memories WHERE id = ?', [id]);
    }).then(() => true);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Query methods
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * Get recent memories for a user, optionally scoped to a guild.
   */
  async getRecent(userId, limit = 20, guildId = null) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      let sql = 'SELECT * FROM memories WHERE user_id = ?';
      const args = [userId];
      if (guildId) { sql += ' AND guild_id = ?'; args.push(guildId); }
      sql += ' ORDER BY created_at DESC LIMIT ?';
      args.push(limit);
      return (await queryAll(db, sql, args)).map(dbRowToMem);
    });
  }

  /**
   * Keyword search across memories, scoped to user + optional guild/tier.
   */
  async search(userId, query, { tier = null, limit = 10, guildId = null } = {}) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      let sql = 'SELECT * FROM memories WHERE user_id = ? AND content LIKE ?';
      const args = [userId, `%${query}%`];
      if (guildId) { sql += ' AND guild_id = ?'; args.push(guildId); }
      if (tier)    { sql += ' AND tier = ?';      args.push(tier); }
      sql += ' ORDER BY value DESC LIMIT ?';
      args.push(limit);
      return (await queryAll(db, sql, args)).map(dbRowToMem);
    });
  }

  /**
   * Count memories matching optional filters.
   */
  async count(userId = null, tier = null, guildId = null) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      let sql = 'SELECT COUNT(*) as cnt FROM memories WHERE 1=1';
      const args = [];
      if (userId)  { sql += ' AND user_id = ?';  args.push(userId);  }
      if (guildId) { sql += ' AND guild_id = ?'; args.push(guildId); }
      if (tier)    { sql += ' AND tier = ?';      args.push(tier);    }
      const row = await queryOne(db, sql, args);
      return Number(row?.cnt ?? 0);
    });
  }

  /**
   * Filter memories by tier, optionally by user/guild.
   */
  async getByTier(tier, { userId = null, limit = 100, guildId = null } = {}) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      let sql = 'SELECT * FROM memories WHERE tier = ?';
      const args = [tier];
      if (userId)  { sql += ' AND user_id = ?';  args.push(userId);  }
      if (guildId) { sql += ' AND guild_id = ?'; args.push(guildId); }
      sql += ' ORDER BY value DESC LIMIT ?';
      args.push(limit);
      return (await queryAll(db, sql, args)).map(dbRowToMem);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Conversation Memory
  // ══════════════════════════════════════════════════════════════════════════

  async storeConversation({ userId, channelId, query, response, guildId }) {
    if (!userId || !query) return;
    this._ensureReady();
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();

    try {
      await withWrite(this._dbPath, async (db) => {
        await db.run(
          `INSERT INTO conversations (id, user_id, guild_id, channel_id, query, response, recorded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [id, userId, guildId ?? '', channelId ?? 'dm', query,
           typeof response === 'string' ? response.slice(0, 500) : '', now],
        );
        // Cap at 5 turns per user+channel
        await db.run(
          `DELETE FROM conversations WHERE id IN (
            SELECT id FROM conversations
            WHERE user_id = ? AND channel_id = ?
            ORDER BY recorded_at DESC
            LIMIT -1 OFFSET 5
          )`,
          [userId, channelId ?? 'dm'],
        );
      });
    } catch { /* fire-and-forget */ }
  }

  async getConversations(userId, channelId, limit = 5) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const rows = await queryAll(db,
        `SELECT user_id, guild_id, channel_id, query, response, recorded_at
         FROM conversations
         WHERE user_id = ? AND channel_id = ? AND recorded_at > ?
         ORDER BY recorded_at DESC LIMIT ?`,
        [userId, channelId ?? 'dm', cutoff, limit],
      );
      return rows.reverse(); // oldest-first for context injection
    });
  }

  async clearConversations(userId, channelId) {
    this._ensureReady();
    return withWrite(this._dbPath, async (db) => {
      await db.run('DELETE FROM conversations WHERE user_id = ? AND channel_id = ?',
        [userId, channelId ?? 'dm']);
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Response Cache (used by aiGateway for Turso-based cache fallback)
  // ══════════════════════════════════════════════════════════════════════════

  async getCachedResponse(cacheKey) {
    this._ensureReady();
    return withRead(this._dbPath, async (db) => {
      const row = await queryOne(db,
        `SELECT cache_key, query, classification, response_text, citations, model, tokens, stored_at
         FROM response_cache WHERE cache_key = ?`,
        [cacheKey],
      );
      if (!row) return null;
      return {
        cacheKey: row.cache_key,
        query: row.query,
        classification: row.classification,
        responseText: row.response_text,
        citations: row.citations ? JSON.parse(row.citations) : [],
        model: row.model,
        tokens: Number(row.tokens ?? 0),
        storedAt: row.stored_at,
      };
    });
  }

  async setCachedResponse({ cacheKey, query, classification, responseText, citations, model, tokens }) {
    this._ensureReady();
    try {
      await withWrite(this._dbPath, async (db) => {
        await db.run(
          `INSERT OR REPLACE INTO response_cache (cache_key, query, classification, response_text, citations, model, tokens, stored_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [cacheKey, query ?? '', classification ?? '', responseText ?? '',
           citations ? JSON.stringify(citations) : null,
           model ?? 'unknown', tokens ?? 0, new Date().toISOString()],
        );
      });
    } catch { /* best-effort */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Internal count helpers
  // ══════════════════════════════════════════════════════════════════════════

  async _convCount() {
    try {
      return withRead(this._dbPath, async (db) => {
        const row = await queryOne(db, 'SELECT COUNT(*) as cnt FROM conversations');
        return Number(row?.cnt ?? 0);
      });
    } catch { return 0; }
  }

  async _cacheCount() {
    try {
      return withRead(this._dbPath, async (db) => {
        const row = await queryOne(db, 'SELECT COUNT(*) as cnt FROM response_cache');
        return Number(row?.cnt ?? 0);
      });
    } catch { return 0; }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Stats
  // ══════════════════════════════════════════════════════════════════════════

  stats() {
    return {
      backend: USE_TURSO ? 'turso' : 'sqlite',
      dbPath: this._dbPath,
      ready: this._ready,
    };
  }
}

export default MemoryManager;
