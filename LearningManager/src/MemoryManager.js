// MemoryManager.js — 8-tier cognitive memory system

export class MemoryManager {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.db = null;
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
    // In production, connect to Turso. For now, use in-memory store.
    this._store = new Map();
    console.log('[MemoryManager] Initialized (in-memory mode)');
  }

  async store(entry) {
    const id = entry.id ?? this._generateId();
    const now = new Date().toISOString();
    
    const memory = {
      id,
      userId: entry.userId,
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
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
    };

    this._store.set(id, memory);
    return memory;
  }

  async get(id) {
    const mem = this._store.get(id);
    if (mem) {
      mem.lastAccessedAt = new Date().toISOString();
      mem.accessCount++;
    }
    return mem ?? null;
  }

  async getRecent(userId, limit = 20) {
    const results = [];
    for (const [, mem] of this._store) {
      if (mem.userId === userId) results.push(mem);
    }
    return results
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit);
  }

  async search(userId, query, { tier = null, limit = 10 } = {}) {
    const results = [];
    for (const [, mem] of this._store) {
      if (mem.userId !== userId) continue;
      if (tier && mem.tier !== tier) continue;
      // Simple content matching (production uses vector + BM25)
      if (mem.content.toLowerCase().includes(query.toLowerCase())) {
        results.push(mem);
      }
    }
    return results
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  async update(id, fields) {
    const mem = this._store.get(id);
    if (!mem) return null;
    Object.assign(mem, fields, { updatedAt: new Date().toISOString() });
    this._store.set(id, mem);
    return mem;
  }

  async delete(id) {
    return this._store.delete(id);
  }

  async count(userId = null, tier = null) {
    let count = 0;
    for (const [, mem] of this._store) {
      if (userId && mem.userId !== userId) continue;
      if (tier && mem.tier !== tier) continue;
      count++;
    }
    return count;
  }

  async getByTier(tier, { userId = null, limit = 100 } = {}) {
    const results = [];
    for (const [, mem] of this._store) {
      if (mem.tier !== tier) continue;
      if (userId && mem.userId !== userId) continue;
      results.push(mem);
    }
    return results
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  async promoteTier(id, newTier) {
    const mem = this._store.get(id);
    if (!mem) return null;
    mem.tier = newTier;
    mem.decayRate = this.tiers[newTier].decayRate;
    mem.importance = Math.min(1, mem.importance * 1.1); // 10% boost on promotion
    mem.updatedAt = new Date().toISOString();
    return mem;
  }

  _generateId() {
    return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
