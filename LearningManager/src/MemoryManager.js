// MemoryManager.js — 8-tier cognitive memory system
// Dual-mode storage: Turso (persistent) when TURSO_DB_URL is set,
// falls back to in-memory Map for local dev / testing.

// ─── SQL column mapping (snake_case DB ↔ camelCase JS) ────────────────────
const COLUMN_MAP = {
  user_id:          'userId',
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
    if (dbCol in mem) {
      mem[jsKey] = mem[dbCol];
      delete mem[dbCol];
    }
  }
  // Convert numeric fields
  if (typeof mem.importance === 'string') mem.importance = Number(mem.importance);
  if (typeof mem.confidence === 'string') mem.confidence = Number(mem.confidence);
  if (typeof mem.value === 'string') mem.value = Number(mem.value);
  if (typeof mem.decayRate === 'string') mem.decayRate = Number(mem.decayRate);
  if (typeof mem.accessCount === 'string') mem.accessCount = Number(mem.accessCount);
  if (typeof mem.protected === 'string') mem.protected = Number(mem.protected);
  return mem;
}

// ─── CREATE TABLE DDL ──────────────────────────────────────────────────────
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
    cache_key       TEXT PRIMARY KEY,
    query           TEXT NOT NULL,
    classification  TEXT NOT NULL,
    response_text   TEXT NOT NULL,
    citations       TEXT,
    model           TEXT,
    tokens          INTEGER DEFAULT 0,
    stored_at       TEXT NOT NULL
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

export class MemoryManager {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this._turso = null;     // libSQL client when connected
    this._store = null;     // Map fallback
    this.tiers = {
      working:     { capacity: 10,   decayRate: 1.386,  ttlMinutes: 5 },
      short_term:  { capacity: 100,  decayRate: 0.231,  ttlHours: 6 },
      long_term:   { capacity: 1000, decayRate: 0.050,  ttlDays: 30 },
      semantic:    { capacity: Infinity, decayRate: 0, ttlDays: Infinity },
      episodic:    { capacity: Infinity, decayRate: 0, ttlDays: Infinity },
      procedural:  { capacity: Infinity, decayRate: 0, ttlDays: Infinity },
      preference:  { capacity: Infinity, decayRate: 0, ttlDays: Infinity },
      goal:        { capacity: Infinity, decayRate: 0.010, ttlDays: Infinity },
    };
  }

  async init() {
    const { url, authToken } = this.dbConfig ?? {};

    if (url) {
      // ── Turso / libSQL persistent mode ──────────────────────────────────
      try {
        const { createClient } = await import('@libsql/client');
        this._turso = createClient({ url, authToken: authToken ?? '' });

        // Create schema — cognitive memories + conversations + response cache
        await this._turso.execute(CREATE_TABLE_SQL);
        await this._turso.execute(CREATE_CONVERSATIONS_SQL);
        await this._turso.execute(CREATE_RESPONSE_CACHE_SQL);
        for (const idxSql of INDEXES_SQL) {
          await this._turso.execute(idxSql);
        }

        // ── Migration: add guild_id column to pre-existing tables ────────
        for (const { table, col } of [
          { table: 'memories', col: 'guild_id TEXT NOT NULL DEFAULT \'\'' },
          { table: 'conversations', col: 'guild_id TEXT NOT NULL DEFAULT \'\'' },
        ]) {
          try { await this._turso.execute(`ALTER TABLE ${table} ADD COLUMN ${col}`); }
          catch { /* column already exists — safe to ignore */ }
        }

        // Verify connection
        const { rows } = await this._turso.execute('SELECT count(*) as cnt FROM memories');
        const convRows = await this._turso.execute('SELECT count(*) as cnt FROM conversations');
        const cacheRows = await this._turso.execute('SELECT count(*) as cnt FROM response_cache');
        console.log(
          `[MemoryManager] Initialized (Turso mode) — ${rows[0]?.cnt ?? 0} memories, ` +
          `${convRows.rows[0]?.cnt ?? 0} conversations, ${cacheRows.rows[0]?.cnt ?? 0} cached responses`
        );
      } catch (err) {
        console.warn(
          `[MemoryManager] Turso connection failed — falling back to in-memory: ${err?.message ?? err}`
        );
        this._turso = null;
        this._store = new Map();
        console.log('[MemoryManager] Initialized (in-memory fallback mode)');
      }
    } else {
      // ── In-memory fallback ──────────────────────────────────────────────
      this._store = new Map();
      console.log('[MemoryManager] Initialized (in-memory mode)');
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // store(entry) — persist a new memory
  // ──────────────────────────────────────────────────────────────────────────
  async store(entry) {
    const id = entry.id ?? this._generateId();
    const now = new Date().toISOString();

    const memory = {
      id,
      userId: entry.userId,
      guildId: entry.guildId ?? '',
      tier: entry.tier ?? 'short_term',
      type: entry.type ?? 'fact',
      content: entry.content,
      summary: entry.summary ?? null,
      importance: entry.importance ?? 0.5,
      confidence: entry.confidence ?? 0.5,
      value: entry.value ?? entry.importance ?? 0.5,
      decayRate: entry.decayRate ?? this.tiers[entry.tier ?? 'short_term'].decayRate,
      accessCount: 0,
      createdAt: now,
      updatedAt: now,
      lastAccessedAt: null,
      expiresAt: null,
      protected: entry.protected ?? false,
      source: entry.source ?? null,
      metadata: entry.metadata ? (typeof entry.metadata === 'string' ? entry.metadata : JSON.stringify(entry.metadata)) : null,
    };

    if (this._turso) {
      await this._turso.execute({
        sql: `INSERT INTO memories
          (id, user_id, guild_id, tier, type, content, summary, importance, confidence, value,
           decay_rate, access_count, created_at, updated_at, last_accessed_at,
           expires_at, protected, source, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          memory.id, memory.userId, memory.guildId, memory.tier, memory.type, memory.content,
          memory.summary, memory.importance, memory.confidence, memory.value,
          memory.decayRate, memory.accessCount, memory.createdAt, memory.updatedAt,
          memory.lastAccessedAt, memory.expiresAt,
          memory.protected ? 1 : 0, memory.source, memory.metadata,
        ],
      });
    } else if (this._store) {
      this._store.set(id, memory);
    }

    return memory;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // get(id) — retrieve a single memory by id
  // ──────────────────────────────────────────────────────────────────────────
  async get(id) {
    if (this._turso) {
      const { rows } = await this._turso.execute({
        sql: `SELECT * FROM memories WHERE id = ?`,
        args: [id],
      });
      if (rows.length === 0) return null;

      const mem = dbRowToMem(rows[0]);
      // Update access metadata
      await this._turso.execute({
        sql: `UPDATE memories SET access_count = access_count + 1, last_accessed_at = ? WHERE id = ?`,
        args: [new Date().toISOString(), id],
      });
      return mem;
    }

    if (this._store) {
      const mem = this._store.get(id);
      if (mem) {
        mem.lastAccessedAt = new Date().toISOString();
        mem.accessCount++;
      }
      return mem ?? null;
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // getRecent(userId, limit, guildId) — most recent memories for a user
  // ──────────────────────────────────────────────────────────────────────────
  async getRecent(userId, limit = 20, guildId = null) {
    if (this._turso) {
      let sql = `SELECT * FROM memories WHERE user_id = ?`;
      const args = [userId];
      if (guildId) { sql += ` AND guild_id = ?`; args.push(guildId); }
      sql += ` ORDER BY created_at DESC LIMIT ?`;
      args.push(limit);

      const { rows } = await this._turso.execute({ sql, args });
      return rows.map(dbRowToMem);
    }

    if (this._store) {
      const results = [];
      for (const [, mem] of this._store) {
        if (mem.userId !== userId) continue;
        if (guildId && mem.guildId !== guildId) continue;
        results.push(mem);
      }
      return results
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // search(userId, query, { tier, limit, guildId }) — keyword search
  // ──────────────────────────────────────────────────────────────────────────
  async search(userId, query, { tier = null, limit = 10, guildId = null } = {}) {
    if (this._turso) {
      let sql = `SELECT * FROM memories WHERE user_id = ? AND content LIKE ?`;
      const args = [userId, `%${query}%`];

      if (guildId) { sql += ` AND guild_id = ?`; args.push(guildId); }
      if (tier)    { sql += ` AND tier = ?`;     args.push(tier); }

      sql += ` ORDER BY value DESC LIMIT ?`;
      args.push(limit);

      const { rows } = await this._turso.execute({ sql, args });
      return rows.map(dbRowToMem);
    }

    if (this._store) {
      const results = [];
      for (const [, mem] of this._store) {
        if (mem.userId !== userId) continue;
        if (guildId && mem.guildId !== guildId) continue;
        if (tier && mem.tier !== tier) continue;
        if (mem.content.toLowerCase().includes(query.toLowerCase())) {
          results.push(mem);
        }
      }
      return results
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    }

    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // update(id, fields) — patch a memory
  // ──────────────────────────────────────────────────────────────────────────
  async update(id, fields) {
    if (this._turso) {
      // Fetch existing first
      const { rows } = await this._turso.execute({
        sql: `SELECT * FROM memories WHERE id = ?`,
        args: [id],
      });
      if (rows.length === 0) return null;

      const existing = dbRowToMem(rows[0]);
      const merged = { ...existing, ...fields, updatedAt: new Date().toISOString() };

      await this._turso.execute({
        sql: `UPDATE memories SET
          user_id = ?, guild_id = ?, tier = ?, type = ?, content = ?, summary = ?,
          importance = ?, confidence = ?, value = ?, decay_rate = ?,
          access_count = ?, updated_at = ?, last_accessed_at = ?,
          expires_at = ?, protected = ?, source = ?, metadata = ?
          WHERE id = ?`,
        args: [
          merged.userId, merged.guildId, merged.tier, merged.type, merged.content, merged.summary,
          merged.importance, merged.confidence, merged.value, merged.decayRate,
          merged.accessCount ?? 0, merged.updatedAt, merged.lastAccessedAt,
          merged.expiresAt, merged.protected ? 1 : 0, merged.source, merged.metadata,
          id,
        ],
      });

      return merged;
    }

    if (this._store) {
      const mem = this._store.get(id);
      if (!mem) return null;
      Object.assign(mem, fields, { updatedAt: new Date().toISOString() });
      this._store.set(id, mem);
      return mem;
    }

    return null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // delete(id) — remove a memory
  // ──────────────────────────────────────────────────────────────────────────
  async delete(id) {
    if (this._turso) {
      const result = await this._turso.execute({
        sql: `DELETE FROM memories WHERE id = ?`,
        args: [id],
      });
      return Number(result.rowsAffected ?? 0) > 0;
    }

    if (this._store) {
      return this._store.delete(id);
    }

    return false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // count(userId, tier, guildId) — count memories matching filters
  // ──────────────────────────────────────────────────────────────────────────
  async count(userId = null, tier = null, guildId = null) {
    if (this._turso) {
      let sql = `SELECT COUNT(*) as cnt FROM memories WHERE 1=1`;
      const args = [];

      if (userId)  { sql += ` AND user_id = ?`;  args.push(userId);  }
      if (guildId) { sql += ` AND guild_id = ?`; args.push(guildId); }
      if (tier)    { sql += ` AND tier = ?`;     args.push(tier);    }

      const { rows } = await this._turso.execute({ sql, args });
      return Number(rows[0]?.cnt ?? 0);
    }

    if (this._store) {
      let count = 0;
      for (const [, mem] of this._store) {
        if (userId && mem.userId !== userId) continue;
        if (guildId && mem.guildId !== guildId) continue;
        if (tier && mem.tier !== tier) continue;
        count++;
      }
      return count;
    }

    return 0;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // getByTier(tier, { userId, limit, guildId }) — filter by tier
  // ──────────────────────────────────────────────────────────────────────────
  async getByTier(tier, { userId = null, limit = 100, guildId = null } = {}) {
    if (this._turso) {
      let sql = `SELECT * FROM memories WHERE tier = ?`;
      const args = [tier];

      if (userId)  { sql += ` AND user_id = ?`;  args.push(userId);  }
      if (guildId) { sql += ` AND guild_id = ?`; args.push(guildId); }

      sql += ` ORDER BY value DESC LIMIT ?`;
      args.push(limit);

      const { rows } = await this._turso.execute({ sql, args });
      return rows.map(dbRowToMem);
    }

    if (this._store) {
      const results = [];
      for (const [, mem] of this._store) {
        if (mem.tier !== tier) continue;
        if (userId && mem.userId !== userId) continue;
        if (guildId && mem.guildId !== guildId) continue;
        results.push(mem);
      }
      return results
        .sort((a, b) => b.value - a.value)
        .slice(0, limit);
    }

    return [];
  }

  // ──────────────────────────────────────────────────────────────────────────
  // promoteTier(id, newTier) — boost a memory to a higher tier
  // ──────────────────────────────────────────────────────────────────────────
  async promoteTier(id, newTier) {
    if (this._turso) {
      const { rows } = await this._turso.execute({
        sql: `SELECT * FROM memories WHERE id = ?`,
        args: [id],
      });
      if (rows.length === 0) return null;

      const mem = dbRowToMem(rows[0]);
      mem.tier = newTier;
      mem.decayRate = this.tiers[newTier].decayRate;
      mem.importance = Math.min(1, mem.importance * 1.1);
      mem.updatedAt = new Date().toISOString();

      await this._turso.execute({
        sql: `UPDATE memories SET tier = ?, decay_rate = ?, importance = ?, updated_at = ? WHERE id = ?`,
        args: [mem.tier, mem.decayRate, mem.importance, mem.updatedAt, id],
      });

      return mem;
    }

    if (this._store) {
      const mem = this._store.get(id);
      if (!mem) return null;
      mem.tier = newTier;
      mem.decayRate = this.tiers[newTier].decayRate;
      mem.importance = Math.min(1, mem.importance * 1.1);
      mem.updatedAt = new Date().toISOString();
      return mem;
    }

    return null;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Conversation Memory (for AdvancedFeatures.js)
  // ══════════════════════════════════════════════════════════════════════════

  async storeConversation({ userId, channelId, query, response, guildId }) {
    if (!userId || !query) return;
    const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const now = new Date().toISOString();

    if (this._turso) {
      try {
        await this._turso.execute({
          sql: `INSERT INTO conversations (id, user_id, guild_id, channel_id, query, response, recorded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [id, userId, guildId ?? '', channelId ?? 'dm', query, typeof response === 'string' ? response.slice(0, 500) : '', now],
        });
        // Cap at 5 turns per user+channel — delete oldest beyond limit
        await this._turso.execute({
          sql: `DELETE FROM conversations WHERE id IN (
                  SELECT id FROM conversations
                  WHERE user_id = ? AND channel_id = ?
                  ORDER BY recorded_at DESC
                  LIMIT -1 OFFSET 5
                )`,
          args: [userId, channelId ?? 'dm'],
        });
      } catch { /* fire-and-forget — never block the hot path */ }
    }
  }

  async getConversations(userId, channelId, limit = 5) {
    if (!this._turso) return [];
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // 30min TTL
      const { rows } = await this._turso.execute({
        sql: `SELECT user_id, guild_id, channel_id, query, response, recorded_at
              FROM conversations
              WHERE user_id = ? AND channel_id = ? AND recorded_at > ?
              ORDER BY recorded_at DESC LIMIT ?`,
        args: [userId, channelId ?? 'dm', cutoff, limit],
      });
      return rows.reverse(); // oldest-first for context injection
    } catch {
      return [];
    }
  }

  async clearConversations(userId, channelId) {
    if (!this._turso) return;
    try {
      await this._turso.execute({
        sql: `DELETE FROM conversations WHERE user_id = ? AND channel_id = ?`,
        args: [userId, channelId ?? 'dm'],
      });
    } catch { /* best-effort */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Response Cache (for Cache.js)
  // ══════════════════════════════════════════════════════════════════════════

  async getCachedResponse(cacheKey) {
    if (!this._turso) return null;
    try {
      const cutoff = new Date(Date.now() - 600_000).toISOString(); // 10min TTL
      const { rows } = await this._turso.execute({
        sql: `SELECT cache_key, query, classification, response_text, citations, model, tokens
              FROM response_cache WHERE cache_key = ? AND stored_at > ?`,
        args: [cacheKey, cutoff],
      });
      if (rows.length === 0) return null;
      const r = rows[0];
      return {
        text: r.response_text,
        citations: r.citations ? JSON.parse(r.citations) : [],
        model: r.model ?? 'cloud',
        tokens: Number(r.tokens ?? 0),
      };
    } catch {
      return null;
    }
  }

  async setCachedResponse({ cacheKey, query, classification, responseText, citations, model, tokens }) {
    if (!this._turso) return;
    try {
      const now = new Date().toISOString();
      await this._turso.execute({
        sql: `INSERT OR REPLACE INTO response_cache
              (cache_key, query, classification, response_text, citations, model, tokens, stored_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          cacheKey, query, classification, responseText,
          citations ? JSON.stringify(citations) : '[]',
          model ?? 'cloud', tokens ?? 0, now,
        ],
      });
    } catch { /* fire-and-forget */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // Turso connection accessor — for external preload
  // ══════════════════════════════════════════════════════════════════════════

  getTurso() {
    return this._turso;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // _generateId() — unique memory identifier
  // ──────────────────────────────────────────────────────────────────────────
  _generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
