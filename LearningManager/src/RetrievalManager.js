// RetrievalManager.js — Hybrid retrieval across memory tiers

export class RetrievalManager {
  constructor(memoryManager, vectorConfig = {}) {
    this.memory = memoryManager;
    this.vectorConfig = vectorConfig;
  }

  async search(query, userId, { tiers = null, limit = 10 } = {}) {
    const searchTiers = tiers ?? ['working', 'short_term', 'long_term', 'semantic'];
    const results = [];

    for (const tier of searchTiers) {
      const tierResults = await this.memory.search(userId, query, { tier, limit: limit * 2 });
      for (const r of tierResults) {
        results.push({
          ...r,
          retrievalScore: this._score(r, query, tier),
        });
      }
    }

    // Sort by retrieval score (descending)
    results.sort((a, b) => b.retrievalScore - a.retrievalScore);

    // Boost accessed memories
    for (const r of results.slice(0, limit)) {
      await this.memory.update(r.id, { lastAccessedAt: new Date().toISOString() });
    }

    return results.slice(0, limit);
  }

  _score(memory, query, tier) {
    let score = 0;

    // Content match (simplified BM25-like scoring)
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = memory.content.toLowerCase().split(/\s+/);
    const matches = queryWords.filter(w => contentWords.includes(w));
    score += matches.length / (queryWords.length || 1) * 0.4;

    // Importance boost
    score += memory.importance * 0.3;

    // Tier priority boost
    const tierPriority = { working: 0.20, short_term: 0.15, long_term: 0.10, semantic: 0.05 };
    score += tierPriority[tier] ?? 0;

    // Recency boost
    const hoursSinceAccess = memory.lastAccessedAt
      ? (Date.now() - new Date(memory.lastAccessedAt).getTime()) / 3600000
      : 24;
    score += 0.1 * Math.exp(-hoursSinceAccess / 24);

    return Math.min(1, score);
  }
}
