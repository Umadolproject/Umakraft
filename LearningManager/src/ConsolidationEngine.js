// ConsolidationEngine.js — Merges, promotes, and summarizes memories

export class ConsolidationEngine {
  constructor(memoryManager) {
    this.memory = memoryManager;
  }

  async consolidate() {
    const results = { merged: 0, promoted: 0, summarized: 0 };
    
    // Find merge candidates (near-duplicate memories)
    const shortTermMemories = await this.memory.getByTier('short_term', { limit: 500 });
    const merged = await this._mergeDuplicates(shortTermMemories);
    results.merged = merged.length;

    // Promote eligible memories to Long-Term
    const promoted = await this._promoteEligible();
    results.promoted = promoted;

    return results;
  }

  async _mergeDuplicates(memories) {
    const merged = [];
    const seen = new Set();

    for (let i = 0; i < memories.length; i++) {
      if (seen.has(memories[i].id)) continue;
      
      const group = [memories[i]];
      for (let j = i + 1; j < memories.length; j++) {
        if (seen.has(memories[j].id)) continue;
        
        // Simple duplicate detection: check for high content overlap
        const similarity = this._contentSimilarity(memories[i].content, memories[j].content);
        if (similarity > 0.7) {
          group.push(memories[j]);
          seen.add(memories[j].id);
        }
      }

      if (group.length > 1) {
        // Merge: take highest-confidence item as base, boost its confidence
        const best = group.reduce((a, b) => a.confidence > b.confidence ? a : b);
        await this.memory.update(best.id, {
          confidence: Math.min(1, best.confidence * 1.1),
          metadata: JSON.stringify({
            mergedFrom: group.map(m => m.id),
            mergedAt: new Date().toISOString(),
          }),
        });

        // Mark others as superseded
        for (const m of group) {
          if (m.id !== best.id) {
            await this.memory.delete(m.id);
          }
        }

        merged.push({ kept: best.id, merged: group.map(m => m.id) });
        seen.add(memories[i].id);
      }
    }

    return merged;
  }

  async _promoteEligible() {
    const candidates = await this.memory.getByTier('short_term', { limit: 200 });
    let promoted = 0;

    for (const mem of candidates) {
      if (mem.importance >= 0.75 || mem.accessCount >= 3) {
        await this.memory.promoteTier(mem.id, 'long_term');
        promoted++;
      }
    }

    return promoted;
  }

  _contentSimilarity(a, b) {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));
    const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);
    return intersection.size / (union.size || 1);
  }
}
