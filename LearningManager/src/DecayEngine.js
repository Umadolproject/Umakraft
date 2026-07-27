// DecayEngine.js — Models forgetting with exponential decay

export class DecayEngine {
  constructor(memoryManager) {
    this.memory = memoryManager;
    this.PRUNE_THRESHOLD = 0.05;
  }

  async applyDecay(tier = 'all') {
    const decayable = ['working', 'short_term', 'long_term'];
    const tiersToDecay = tier === 'all' ? decayable : [tier].filter(t => decayable.includes(t));
    
    let pruned = 0;
    
    for (const t of tiersToDecay) {
      const memories = await this.memory.getByTier(t, { limit: 1000 });
      
      for (const mem of memories) {
        if (mem.protected) continue;
        
        const hoursSinceCreation = (Date.now() - new Date(mem.createdAt).getTime()) / 3600000;
        const decayed = mem.value * Math.exp(-mem.decayRate * hoursSinceCreation);
        
        if (decayed < this.PRUNE_THRESHOLD) {
          await this.memory.delete(mem.id);
          pruned++;
        } else {
          await this.memory.update(mem.id, { value: decayed });
        }
      }
    }
    
    return pruned;
  }

  async accessBoost(id) {
    const mem = await this.memory.get(id);
    if (!mem) return;
    
    const boosted = Math.min(1.0, mem.value * 1.05);
    await this.memory.update(mem.id, {
      value: boosted,
      lastAccessedAt: new Date().toISOString(),
    });
  }

  async activeUseBoost(id) {
    const mem = await this.memory.get(id);
    if (!mem) return;
    
    const boosted = Math.min(1.0, mem.value * 1.10);
    await this.memory.update(mem.id, {
      value: boosted,
      lastAccessedAt: new Date().toISOString(),
    });
  }
}
