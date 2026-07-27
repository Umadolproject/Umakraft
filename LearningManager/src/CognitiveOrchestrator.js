// CognitiveOrchestrator.js — Executive function for the cognitive OS

export class CognitiveOrchestrator {
  constructor({ retrieval, reflection, config }) {
    this.retrieval = retrieval;
    this.reflection = reflection;
    this.config = config;
  }

  /**
   * Process a query through the full cognitive pipeline.
   */
  async process(query, context = {}) {
    const { userId } = context;
    
    // 1. Classify intent
    const intent = this._classifyIntent(query);
    
    // 2. Plan: determine what tools and memory tiers to engage
    const plan = this._plan(intent, context);
    
    // 3. Retrieve relevant context
    let retrievedContext = '';
    if (plan.retrieve) {
      const memories = await this.retrieval.search(query, userId, {
        tiers: plan.memoryTiers,
        limit: plan.retrievalLimit,
      });
      retrievedContext = this._formatContext(memories);
    }
    
    return {
      intent,
      plan,
      retrievedContext,
      memoryTiers: plan.memoryTiers,
    };
  }

  _classifyIntent(query) {
    const lower = query.toLowerCase();
    
    if (/^(what|who|define|explain|how|why|when|where)\b/.test(lower)) {
      return { type: 'knowledge', subtype: 'factual' };
    }
    if (/\b(compare|vs|versus|difference|better)\b/.test(lower)) {
      return { type: 'knowledge', subtype: 'comparison' };
    }
    if (/\b(help|guide|how.?to|steps?)\b/.test(lower)) {
      return { type: 'procedural', subtype: 'tutorial' };
    }
    if (/\b(my|mine|me)\b.*\b(stats?|fans?|rank|profile)\b/.test(lower)) {
      return { type: 'personal', subtype: 'stats' };
    }
    if (/\b(remember|recall|what did|you said|earlier|before)\b/.test(lower)) {
      return { type: 'memory', subtype: 'recall' };
    }
    
    return { type: 'general', subtype: 'conversation' };
  }

  _plan(intent, context) {
    const plan = {
      retrieve: true,
      memoryTiers: ['working', 'short_term'],
      retrievalLimit: 10,
      tools: [],
    };
    
    switch (intent.type) {
      case 'knowledge':
        plan.memoryTiers = ['semantic', 'long_term', 'short_term', 'working'];
        plan.retrievalLimit = 15;
        break;
      case 'procedural':
        plan.memoryTiers = ['procedural', 'semantic', 'short_term'];
        plan.retrievalLimit = 10;
        break;
      case 'personal':
        plan.memoryTiers = ['preference', 'episodic', 'short_term'];
        plan.retrievalLimit = 5;
        break;
      case 'memory':
        plan.memoryTiers = ['episodic', 'short_term', 'working'];
        plan.retrievalLimit = 10;
        break;
    }
    
    return plan;
  }

  _formatContext(memories) {
    if (!memories || memories.length === 0) return '';
    return memories
      .map(m => `[${m.tier}] ${m.content}`)
      .join('\n');
  }
}
