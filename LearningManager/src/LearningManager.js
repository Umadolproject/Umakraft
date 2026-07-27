// LearningManager.js — Main entry point
// Cognitive AI Framework v1.0

import { MemoryManager } from './MemoryManager.js';
import { KnowledgeExtractor } from './KnowledgeExtractor.js';
import { ImportanceEngine } from './ImportanceEngine.js';  // stub
import { ConsolidationEngine } from './ConsolidationEngine.js';
import { DecayEngine } from './DecayEngine.js';
import { ReflectionManager } from './ReflectionManager.js';
import { CuriosityEngine } from './CuriosityEngine.js';
import { RetrievalManager } from './RetrievalManager.js';
import { CognitiveOrchestrator } from './CognitiveOrchestrator.js';

export class LearningManager {
  constructor(config = {}) {
    this.config = config;
    this.ready = false;
  }

  async init() {
    // Initialize memory system
    this.memory = new MemoryManager(this.config.db);
    await this.memory.init();

    // Initialize learning components
    this.extractor = new KnowledgeExtractor({ llm: this.config.llm });
    this.importance = new ImportanceEngine(this.config.weights);
    this.consolidation = new ConsolidationEngine(this.memory);
    this.decay = new DecayEngine(this.memory);
    this.reflection = new ReflectionManager();
    this.curiosity = new CuriosityEngine(this.config);
    this.retrieval = new RetrievalManager(this.memory, this.config.vector);

    // Initialize orchestrator
    this.orchestrator = new CognitiveOrchestrator({
      retrieval: this.retrieval,
      reflection: this.reflection,
      config: this.config,
    });

    // Start background schedulers
    this._startSchedulers();

    this.ready = true;
    console.log('[LearningManager] Initialized');
    return this;
  }

  /**
   * Process a single interaction through the full learning pipeline.
   */
  async process(interaction) {
    if (!this.ready) throw new Error('LearningManager not initialized');

    const { userId, query, response, metadata } = interaction;
    const startedAt = Date.now();

    // 1. Extract knowledge from the interaction
    const extracted = await this.extractor.extract({ query, response, userId });

    // 2. Score importance of each extracted item
    const scored = [];
    for (const item of extracted) {
      // Use extractor-set importance if present, otherwise compute with ImportanceEngine
      const importance = item.importance ?? await this.importance.score(item, {
        existingMemories: await this.memory.getRecent(userId, 20),
        domain: metadata?.domain ?? 'general',
        interaction: { text: query + ' ' + response },
        usedInResponse: item.type === 'fact',
        feedback: metadata?.feedback ?? 0.5,
        fillsGap: item.type === 'correction',
      });
      scored.push({ ...item, importance });
    }

    // 3. Store scored items in appropriate memory tier
    for (const item of scored) {
      const tier = this._determineTier(item.importance);
      await this.memory.store({
        ...item,
        userId,
        tier,
        value: item.importance,
        source: metadata?.interactionId,
      });
    }

    // 4. Reflect on the interaction
    const reflection = await this.reflection.reflect({
      query,
      response,
      sources: metadata?.sources ?? [],
      retrieved: metadata?.retrieved ?? [],
    });

    // 5. Log the interaction
    const latencyMs = Date.now() - startedAt;

    return {
      extractedFacts: scored.filter(i => i.type === 'fact' || i.type === 'definition').length,
      extractedPatterns: scored.filter(i => i.type === 'pattern').length,
      extractedCorrections: scored.filter(i => i.type === 'correction').length,
      averageImportance: scored.reduce((s, i) => s + i.importance, 0) / (scored.length || 1),
      reflectionAction: reflection.action,
      latencyMs,
    };
  }

  /**
   * Retrieve relevant context for a query.
   */
  async retrieveContext(query, userId) {
    return this.retrieval.search(query, userId);
  }

  /**
   * Get learning statistics.
   */
  async getStats(userId = null) {
    const tiers = ['working', 'short_term', 'long_term', 'semantic', 'episodic', 'procedural', 'preference', 'goal'];
    const stats = {};

    for (const tier of tiers) {
      const count = await this.memory.count(userId, tier);
      stats[tier] = count;
    }

    stats.total = Object.values(stats).reduce((a, b) => a + b, 0);
    return stats;
  }

  // ─── Private ────────────────────────────────────────────────────────────

  _determineTier(importance) {
    if (importance >= 0.90) return 'long_term';
    if (importance >= 0.60) return 'short_term';
    if (importance >= 0.40) return 'short_term';
    return 'working';
  }

  _startSchedulers() {
    // Consolidation: every 15 minutes
    setInterval(async () => {
      try {
        const result = await this.consolidation.consolidate();
        if (result.merged > 0 || result.promoted > 0) {
          console.log(`[LearningManager] Consolidation: ${result.merged} merged, ${result.promoted} promoted`);
        }
      } catch (err) {
        console.error('[LearningManager] Consolidation error:', err.message);
      }
    }, 15 * 60 * 1000).unref();

    // Decay: every 30 minutes
    setInterval(async () => {
      try {
        const pruned = await this.decay.applyDecay();
        if (pruned > 0) {
          console.log(`[LearningManager] Decay: ${pruned} memories pruned`);
        }
      } catch (err) {
        console.error('[LearningManager] Decay error:', err.message);
      }
    }, 30 * 60 * 1000).unref();

    // Curiosity: every 2 hours
    setInterval(async () => {
      try {
        await this.curiosity.explore();
      } catch (err) {
        console.error('[LearningManager] Curiosity error:', err.message);
      }
    }, 2 * 60 * 60 * 1000).unref();

    console.log('[LearningManager] Background schedulers started');
  }
}
