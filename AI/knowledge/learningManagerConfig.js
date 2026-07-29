// AI/knowledge/learningManagerConfig.js
// LearningManager integration configuration for Umakraft.
// All values have env-var overrides for Railway / local development.
//
// Usage:
//   import lmConfig from './knowledge/learningManagerConfig.js';
//   const lm = new LearningManager(lmConfig);

export default {
  // ── Database ────────────────────────────────────────────────────────────
  // Turso (distributed SQLite) — cognitive memories persist to Turso.
  // Priority: TURSO_DATABASE_URL (shared with core/sqlite.js) → TURSO_DB_URL
  // (dedicated cognitive memory DB) → in-memory fallback.
  db: {
    url:       process.env.TURSO_DATABASE_URL ?? process.env.TURSO_DB_URL ?? null,
    authToken: process.env.TURSO_AUTH_TOKEN   ?? null,
  },

  // ── Vector Store ────────────────────────────────────────────────────────
  // Qdrant for production, in-memory for local dev.
  vector: {
    provider:   process.env.QDRANT_URL ? 'qdrant' : 'memory',
    url:        process.env.QDRANT_URL      ?? null,
    apiKey:     process.env.QDRANT_API_KEY  ?? null,
    dimensions: 1024,                         // Cohere embed-multilingual-v3.0
  },

  // ── Embeddings ──────────────────────────────────────────────────────────
  // Cohere for semantic search. Optional — retrieval degrades to keyword-only.
  embedding: {
    provider: process.env.COHERE_API_KEY ? 'cohere' : 'none',
    model:    'embed-multilingual-v3.0',
    apiKey:   process.env.COHERE_API_KEY ?? null,
  },

  // ── LLM ─────────────────────────────────────────────────────────────────
  // Used for curiosity investigation and deep reflection.
  // Optional — the system runs in observation-only mode without one.
  llm: {
    provider: process.env.LLM_API_KEY ? 'cloud' : 'none',
    apiKey:   process.env.LLM_API_KEY ?? null,
  },

  // ── Memory Tiers ────────────────────────────────────────────────────────
  memory: {
    workingMemorySize:  10,
    shortTermCapacity:  100,
    longTermCapacity:   1000,
    decayRates: {
      working:    1.386,    // per minute (half-life: 30s)
      shortTerm:  0.231,    // per hour   (half-life: 3h)
      longTerm:   0.050,    // per day    (half-life: 14d)
      goal:       0.010,    // per day    (half-life: 70d)
    },
  },

  // ── Learning Pipeline ───────────────────────────────────────────────────
  learning: {
    weights: {
      novelty:   0.3,
      relevance: 0.3,
      emotion:   0.2,
      utility:   0.2,
    },
    consolidationInterval:     15,    // minutes
    decayInterval:             30,    // minutes
    reflectionInterval:        60,    // minutes
    curiosityInterval:         120,   // minutes (2 hours)
    experienceReplayInterval:  240,   // minutes (4 hours)
  },
};
