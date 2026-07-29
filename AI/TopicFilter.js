// AI/TopicFilter.js
// Scope enforcement gate — classifies every request before any retrieval or generation.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/TOPIC_FILTER.md
//
// Two outputs per non-rejected request:
//   1. topic      — 'repository' | 'umamusume' | 'live' | 'message' | 'web' | 'off-topic'
//   2. complexity — 'simple' | 'complex'
//
// Classification pipeline:
//   Keyword (fast, synchronous) → Semantic embedding (async, for low-confidence)
//   The semantic path uses the same local embedding provider via EmbeddingManager.
//
// Public API:
//   classify(query, commandOverride?)           → ClassificationResult (sync, keyword-only)
//   classifyAsync(query, commandOverride?)      → ClassificationResult (async, keyword + semantic)
//   offTopicMessage()                           → string

import log from '../core/log.js';
import config from './Configuration.js';

// ---------------------------------------------------------------------------
// Keyword lists (expanded for real user phrasing)
// ---------------------------------------------------------------------------

const REPOSITORY_KEYWORDS = [
  'vault', 'miner', 'courier', 'inspector', 'refinery', 'refiner', 'compiler',
  'depot', 'workshop', 'fabricator', 'draftsman', 'blueprint', 'terminal',
  'broadcast', 'broker', 'archive', 'announcer', 'distribution', 'dispatcher',
  'coordinator', 'operation', 'investigator', 'manager', 'governance',
  'architecture', 'pipeline', 'stage', 'umakraft', 'uma.moe', 'task',
  'scheduler', 'health', 'cron', 'fantracking', 'milestone threshold',
  'core/errors', 'core/log', 'RepositoryIndexer', 'VectorDatabase',
];

const UMAMUSUME_KEYWORDS = [
  // ── Original core terms ───────────────────────────────────────────────
  'uma musume', 'umamusume', 'pretty derby', 'mant', 'fan gain', 'fan count',
  'circle rank', 'trainer level', 'trainer rank', 'skill card', 'race',
  'fan deficit', 'projected fans', 'horse girl', 'leaderboard ranking',
  'circle member', 'uma moe', 'gain source', 'trend tier',
  // ── Fan synonyms (users say "followers" not "fans") ───────────────────
  'followers', 'fans gain', 'gaining fans', 'fan growth', 'fan increase',
  'fan boost', 'more fans', 'get fans', 'earn fans', 'how to get fans',
  // ── Circle synonyms ───────────────────────────────────────────────────
  'my circle', 'circle level', 'circle tier', 'circle points',
  // ── Training synonyms ─────────────────────────────────────────────────
  'train my', 'how to train', 'training my', 'training guide',
  'best training', 'training build', 'training method',
  // ── Horse / character synonyms ────────────────────────────────────────
  'my horse', 'my girl', 'my uma', 'my character', 'horse racing',
  // ── Inheritance ───────────────────────────────────────────────────────
  'inherit', 'inheritance', 'factor', 'factors', 'inheritance factor',
  // ── Cards ─────────────────────────────────────────────────────────────
  'support card', 'card build', 'ssr card', 'sr card',
  'best card', 'card recommendation', 'deck build', 'card setup',
  // ── Scenario / events ─────────────────────────────────────────────────
  'scenario', 'event card', 'mission race', 'uma scenario',
  // ── Common question patterns ──────────────────────────────────────────
  'which horse', 'best horse', 'best girl', 'best support',
  'should i use', 'which is better', 'what should i',
  'how to get more', 'how to earn more', 'what is the best',
  // ── Stats ─────────────────────────────────────────────────────────────
  'speed stat', 'stamina stat', 'power stat', 'guts stat', 'wisdom stat',
  // ── Resources / tools ─────────────────────────────────────────────────
  'gametora', 'uma guide', 'game8', 'umamusume.run', 'umamusumedb', 'umamusume.gg',
  'umalator', 'umaarchive', 'uma archive', 'uma reference', 'umareference',
  // ── Character / horse names (prevent false off-topic rejections) ───────
  'king halo', 'special week', 'silence suzuka', 'tokai teio', 'mejiro mcqueen',
  'rice shower', 'el condor pasa', 'grass wonder', 'seiun sky', 'air groove',
  'admire vega', 'taiki shuttle', 'agnes tachyon', 'fine motion', 'air shakur',
  'symboli rudolf', 'oguri cap', 'tamamo cross', 'vodka', 'daiwa scarlet',
  'gold ship', 'mayano top gun', 'narita brian', 'biwa hayahide', 'nishino flower',
  'winning ticket', 'super creek', 'manhattan cafe', 'zenno rob roy', 'smartfalcon',
  'sweep tosho', 'sakura bakushin o', 'twin turbo', 'haru urara', 'maruzensky',
  'fuji kiseki', 'narita taishin', 'curren chan', 'yukino bijin', 'ikuno dictus',
  'wonder acute', 'nice nature', 'mihono bourbon', 'takarakosmos', 'hokko tarumae',
];

const MESSAGE_KEYWORDS = [
  'generate', 'message', 'greeting', 'announcement', 'warning message',
  'reminder', 'milestone message', 'achievement message', 'leaderboard message',
  '/ai message', 'write a message', 'create a message', 'draft a message',
];

const LIVE_KEYWORDS = [
  'right now', 'currently', 'today', 'this week', 'latest', 'recent update',
  'patch', 'trending', 'live', 'current rankings', 'current top',
  'new event', 'just announced', 'what changed', 'new season', 'right now',
  'as of now', 'at the moment',
];

const OFF_TOPIC_INDICATORS = [
  'president', 'prime minister', 'stock', 'crypto', 'sports score',
  'movie', 'recipe', 'weather', 'political', 'medical', 'legal advice',
  'relationship advice', 'romance', 'religion', 'joke', 'meme',
  'pokemon', 'fortnite', 'minecraft', 'league of legends', 'genshin',
  'roblox', 'valorant', 'war', 'weapon', 'drug',
];

const BOT_ASSIST_KEYWORDS = [
  'link me', 'please link', 'how to link', 'get linked', 'am i linked',
  'my link', 'i am not linked', 'i am linked', 'linking',
  'how many fans', 'my fans', 'my fan gain', 'my profile', 'my rank',
  'check my', 'show my', 'how do i', 'what command', 'help me with',
  'link my', 'unlink me', 'who can link', 'can you link',
  '/link', '/fan_gain', '/profile', '/leaderboard',
  'how to use', 'how does the bot', 'bot command',
  'who is the admin', 'ask admin', 'need admin',
];

const COMPLEXITY_KEYWORDS = [
  'explain', 'analyze', 'analyse', 'compare', 'strategy', 'why', 'how does',
  'difference between', 'best way', 'recommend', 'guide', 'optimize',
  'improve', 'in depth', 'detailed', 'breakdown', 'walk me through',
  'step by step', 'architecture', 'design', 'pattern',
];

// ---------------------------------------------------------------------------
// Intent prototypes — used by the semantic embedding classifier
// Each prototype describes what a query in that category sounds like.
// These are embedded once at startup and compared against user queries.
// ---------------------------------------------------------------------------

const INTENT_PROTOTYPES = {
  umamusume: [
    'uma musume pretty derby horse girl racing training fan gain circle rank skill card support card',
    'how to train horse girl best card build inheritance factor scenario guide',
    'which horse is best what support card should I use how to get more fans',
    'uma musume game mechanics fan calculation circle ranking leaderboard',
  ],
  repository: [
    'vault miner refinery fabricator pipeline depot workshop blueprint codebase',
    'how does the bot work source code architecture implementation technical documentation',
    'broker dispatcher coordinator governance operation task scheduler',
  ],
  message: [
    'generate write create draft greeting announcement milestone achievement reminder',
    'compose a message for the server notification leaderboard update',
  ],
  live: [
    'current today latest recent rankings trending update patch season',
    'what is happening right now new event just announced',
  ],
  bot_assist: [
    'link my account how to link profile register setup bot command help',
    'how do I use this bot what commands are available help me with linking',
  ],
  web: [
    'search find look up information news general knowledge question answer',
    'what is who is where can I find tell me about',
  ],
};

// Cache for prototype embeddings (lazy-initialized on first semantic classify)
let _prototypeVectors = null;

// ---------------------------------------------------------------------------
// Command overrides — bypass the keyword classifier entirely
// ---------------------------------------------------------------------------

const COMMAND_OVERRIDES = {
  '/ai search':   { topic: 'repository',  complexity: 'complex' },
  '/ai docs':     { topic: 'repository',  complexity: 'complex' },
  '/ai glossary': { topic: 'umamusume',   complexity: 'simple'  },
  '/ai live':     { topic: 'live',        complexity: 'simple'  },
  '/ai message':  { topic: 'message',     complexity: 'complex' },
  '/ask':         { topic: null,          complexity: null       }, // classify normally
  '/ai explain':  { topic: null,          complexity: 'complex' }, // topic still classified
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalise(str) {
  return str.toLowerCase().replace(/[^a-z0-9 ./\-_]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Count how many keywords from a list appear in the query.
 * Uses word-boundary matching to avoid false positives (e.g. "war" matching "warning").
 */
function countHits(query, keywords) {
  const q = normalise(query);
  // Build word-boundary regexes instead of simple includes()
  return keywords.filter(k => {
    const escaped = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match at word boundaries or start/end of string
    const re = new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`, 'i');
    return re.test(q);
  }).length;
}

/**
 * Determine complexity tier for a given topic and query.
 */
function assignComplexity(topic, query) {
  if (topic === 'repository') return 'complex';
  if (topic === 'message')    return 'complex';
  const q = normalise(query);
  const hasComplexity = COMPLEXITY_KEYWORDS.some(k => q.includes(k.toLowerCase()));
  return hasComplexity ? 'complex' : 'simple';
}

// ---------------------------------------------------------------------------
// Cosine similarity — for comparing embedding vectors
// ---------------------------------------------------------------------------

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

// ---------------------------------------------------------------------------
// Semantic embedding classifier (lazy init)
// ---------------------------------------------------------------------------

/**
 * Initialize prototype embedding vectors. Called once, lazily.
 * Embeds all INTENT_PROTOTYPES and caches them.
 */
async function _initPrototypes() {
  if (_prototypeVectors) return;

  // Dynamic import to avoid circular dependency at module load
  const { embed: embedText } = await import('./managers/EmbeddingManager.js');

  _prototypeVectors = {};

  for (const [topic, phrases] of Object.entries(INTENT_PROTOTYPES)) {
    try {
      // Combine all phrases for this topic into one embedding
      const combinedText = phrases.join(' ');
      const { vector } = await embedText(combinedText);
      _prototypeVectors[topic] = vector;
    } catch (err) {
      log.warn(`[TopicFilter] Failed to embed prototype "${topic}": ${err.message}`);
    }
  }

  log.info(`[TopicFilter] Semantic prototypes initialized: ${Object.keys(_prototypeVectors).length} topics`);
}

/**
 * Compute semantic similarity between a query and all intent prototypes.
 *
 * @param {string} query
 * @returns {Promise<{[topic: string]: number}>}
 */
async function _semanticScores(query) {
  try {
    await _initPrototypes();
    const { embed: embedText } = await import('./managers/EmbeddingManager.js');
    const { vector } = await embedText(query);

    const scores = {};
    for (const [topic, protoVector] of Object.entries(_prototypeVectors)) {
      scores[topic] = cosineSimilarity(vector, protoVector);
    }
    return scores;
  } catch (err) {
    log.warn(`[TopicFilter] Semantic scoring failed: ${err.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ClassificationResult
 * @property {'repository'|'umamusume'|'live'|'message'|'web'|'off-topic'} topic
 * @property {'simple'|'complex'|null} complexity — null when off-topic
 * @property {number} confidence — 0.0–1.0
 * @property {'keyword'|'semantic'|'hybrid'|'command-override'|'off-topic-indicator'} method
 * @property {'bot_assist'|null} subtopic — set when query is bot-assistance related
 * @property {boolean} rejected
 * @property {string|null} rejectionMessage
 */

/**
 * Classify a user query (keyword-only, synchronous).
 * Fast path — used for obvious queries. For ambiguous queries, use classifyAsync().
 *
 * @param {string} query
 * @param {string|null} [commandOverride]  — e.g. '/ai message', '/ai search'
 * @returns {ClassificationResult}
 */
export function classify(query, commandOverride = null) {
  const q = normalise(query);

  // ── Command override ──────────────────────────────────────────────────
  if (commandOverride) {
    const overrideKey = Object.keys(COMMAND_OVERRIDES).find(k => commandOverride.startsWith(k));
    if (overrideKey) {
      const override = COMMAND_OVERRIDES[overrideKey];
      if (override.topic) {
        const result = {
          topic:            override.topic,
          complexity:       override.complexity ?? assignComplexity(override.topic, query),
          confidence:       1.0,
          method:           'command-override',
          subtopic:         null,
          rejected:         false,
          rejectionMessage: null,
        };
        _auditLog(query, result);
        return result;
      }
      const classified = _keywordClassify(q);
      if (override.complexity) classified.complexity = override.complexity;
      _auditLog(query, classified);
      return classified;
    }
  }

  const classified = _keywordClassify(q);
  _auditLog(query, classified);
  return classified;
}

/**
 * Classify a user query with semantic embedding fallback (async).
 * Uses keyword matching first, then semantic embedding comparison when
 * keyword confidence is low. This catches queries like "how do I get
 * more followers" that don't match exact keywords.
 *
 * @param {string} query
 * @param {string|null} [commandOverride]
 * @returns {Promise<ClassificationResult>}
 */
export async function classifyAsync(query, commandOverride = null) {
  // Run keyword classifier first (instant)
  const keywordResult = classify(query, commandOverride);

  // High confidence or command override — trust keyword result
  if (
    keywordResult.confidence >= 0.65 ||
    keywordResult.method === 'command-override' ||
    keywordResult.rejected
  ) {
    return keywordResult;
  }

  // Low confidence — try semantic classification
  const semanticScores = await _semanticScores(query);
  if (!semanticScores) {
    // Semantic failed — trust keyword but mark as low-confidence
    keywordResult.method = 'keyword';
    return keywordResult;
  }

  // Find best semantic match
  const sorted = Object.entries(semanticScores)
    .filter(([topic]) => topic !== 'off-topic') // off-topic isn't a real topic for routing
    .sort((a, b) => b[1] - a[1]);
  const [bestTopic, bestScore] = sorted[0];

  // Blend keyword + semantic scores:
  //   - If keyword had 0 hits, trust semantic fully (70% semantic weight)
  //   - If keyword had some hits, give keyword 30% say
  const keywordWeight = keywordResult.confidence >= 0.4 ? 0.3 : 0.1;
  const semanticWeight = 1.0 - keywordWeight;
  const blendedConfidence = Math.min(
    bestScore * semanticWeight + keywordResult.confidence * keywordWeight,
    1.0
  );

  log.info(
    `[TopicFilter] Semantic override: keyword=${keywordResult.topic}(c=${keywordResult.confidence?.toFixed(2)}) ` +
    `→ semantic=${bestTopic}(c=${blendedConfidence.toFixed(2)}) query="${query.slice(0, 80)}"`
  );

  const result = {
    topic:            bestTopic,
    complexity:       assignComplexity(bestTopic, query),
    confidence:       blendedConfidence,
    method:           'hybrid',
    subtopic:         keywordResult.subtopic,
    rejected:         false,
    rejectionMessage: null,
  };
  _auditLog(query, result);
  return result;
}

// ---------------------------------------------------------------------------
// Internal — keyword-only classification
// ---------------------------------------------------------------------------

/** @private */
function _keywordClassify(q) {
  // ── Bot command assistance — route as umamusume with subtopic flag ──
  const botHits = countHits(q, BOT_ASSIST_KEYWORDS);
  if (botHits > 0) {
    return {
      topic:            'umamusume',
      complexity:       'simple',
      confidence:       0.9,
      method:           'keyword',
      subtopic:         'bot_assist',
      rejected:         false,
      rejectionMessage: null,
    };
  }

  // Count topic hits FIRST — before off-topic check
  const repoHits    = countHits(q, REPOSITORY_KEYWORDS);
  const umaHits     = countHits(q, UMAMUSUME_KEYWORDS);
  const messageHits = countHits(q, MESSAGE_KEYWORDS);
  const liveHits    = countHits(q, LIVE_KEYWORDS);

  const total = repoHits + umaHits + messageHits + liveHits;

  // Off-topic check — only reject if NO valid topic keywords match
  // This prevents false rejections when a query mentions off-topic
  // subjects alongside valid uma/repository/message/live topics.
  const offTopicHits = countHits(q, OFF_TOPIC_INDICATORS);
  if (offTopicHits > 0 && total === 0) {
    return {
      topic:            'off-topic',
      complexity:       null,
      confidence:       Math.min(0.5 + offTopicHits * 0.2, 1.0),
      method:           'off-topic-indicator',
      subtopic:         null,
      rejected:         true,
      rejectionMessage: offTopicMessage(),
    };
  }

  // No hits — mark as web with low confidence (semantic will likely override)
  if (total === 0) {
    return {
      topic:            'web',
      complexity:       'simple',
      confidence:       0.3,
      method:           'keyword',
      subtopic:         null,
      rejected:         false,
      rejectionMessage: null,
    };
  }

  // Rank categories by hit count
  const scores = [
    { topic: 'repository', hits: repoHits },
    { topic: 'umamusume',  hits: umaHits  },
    { topic: 'message',    hits: messageHits },
    { topic: 'live',       hits: liveHits },
  ].sort((a, b) => b.hits - a.hits);

  const winner    = scores[0];
  const confidence = Math.min(0.5 + (winner.hits / total) * 0.5, 1.0);

  // Below confidence threshold — web search fallback
  if (confidence < config.topicFilterConfidenceThreshold && winner.hits === 0) {
    return {
      topic:            'web',
      complexity:       'simple',
      confidence,
      method:           'keyword',
      subtopic:         null,
      rejected:         false,
      rejectionMessage: null,
    };
  }

  return {
    topic:            winner.topic,
    complexity:       assignComplexity(winner.topic, q),
    confidence,
    method:           'keyword',
    subtopic:         null,
    rejected:         false,
    rejectionMessage: null,
  };
}

/** @private */
function _auditLog(query, result) {
  if (!config.topicFilterAuditLog) return;
  log.info(JSON.stringify({
    timestamp:      new Date().toISOString(),
    component:      'TopicFilter',
    query:          query.slice(0, 120),
    classification: result.topic,
    subtopic:       result.subtopic ?? null,
    confidence:     result.confidence,
    method:         result.method,
    complexity:     result.complexity,
    rejected:       result.rejected,
  }));
}

/**
 * The standard off-topic rejection message shown to Discord users.
 * @returns {string}
 */
export function offTopicMessage() {
  return (
    'i am the bot of umakraft'
  );
}
