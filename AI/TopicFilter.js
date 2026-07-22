// AI/TopicFilter.js
// Scope enforcement gate — classifies every request before any retrieval or generation.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/TOPIC_FILTER.md
//
// Two outputs per non-rejected request:
//   1. topic      — 'repository' | 'umamusume' | 'live' | 'message' | 'off-topic'
//   2. complexity — 'simple' | 'complex'
//
// Public API:
//   classify(query, commandOverride?)  → ClassificationResult
//   offTopicMessage()                  → string

import log from '../core/log.js';
import config from './Configuration.js';

// ---------------------------------------------------------------------------
// Keyword lists (per TOPIC_FILTER.md)
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
  'uma musume', 'umamusume', 'pretty derby', 'mant', 'fan gain', 'fan count',
  'circle rank', 'trainer level', 'trainer rank', 'skill card', 'race',
  'fan deficit', 'projected fans', 'horse girl', 'leaderboard ranking',
  'circle member', 'uma moe', 'gain source', 'trend tier',
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

const COMPLEXITY_KEYWORDS = [
  'explain', 'analyze', 'analyse', 'compare', 'strategy', 'why', 'how does',
  'difference between', 'best way', 'recommend', 'guide', 'optimize',
  'improve', 'in depth', 'detailed', 'breakdown', 'walk me through',
  'step by step', 'architecture', 'design', 'pattern',
];

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
 * Returns a hit count (not normalised — caller decides threshold).
 */
function countHits(query, keywords) {
  const q = normalise(query);
  return keywords.filter(k => q.includes(k.toLowerCase())).length;
}

/**
 * Determine complexity tier for a given topic and query.
 */
function assignComplexity(topic, query) {
  if (topic === 'repository') return 'complex'; // always
  if (topic === 'message')    return 'complex'; // always
  // umamusume and live: simple by default, upgrade if complexity keywords present
  const q = normalise(query);
  const hasComplexity = COMPLEXITY_KEYWORDS.some(k => q.includes(k.toLowerCase()));
  return hasComplexity ? 'complex' : 'simple';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ClassificationResult
 * @property {'repository'|'umamusume'|'live'|'message'|'off-topic'} topic
 * @property {'simple'|'complex'|null} complexity — null when off-topic
 * @property {number} confidence — 0.0–1.0
 * @property {'keyword'|'semantic'|'command-override'|'off-topic-indicator'} method
 * @property {boolean} rejected
 * @property {string|null} rejectionMessage
 */

/**
 * Classify a user query.
 *
 * @param {string} query
 * @param {string|null} [commandOverride]  — e.g. '/ai message', '/ai search'
 * @returns {ClassificationResult}
 */
export function classify(query, commandOverride = null) {
  const q = normalise(query);

  // ── Command override ────────────────────────────────────────────────────────
  if (commandOverride) {
    const overrideKey = Object.keys(COMMAND_OVERRIDES).find(k => commandOverride.startsWith(k));
    if (overrideKey) {
      const override = COMMAND_OVERRIDES[overrideKey];
      if (override.topic) {
        // Full override — topic and complexity are fixed
        const result = {
          topic:            override.topic,
          complexity:       override.complexity ?? assignComplexity(override.topic, query),
          confidence:       1.0,
          method:           'command-override',
          rejected:         false,
          rejectionMessage: null,
        };
        _auditLog(query, result);
        return result;
      }
      // Partial override (e.g. /ask) — classify topic normally, use override complexity if set
      const classified = _keywordClassify(q);
      if (override.complexity) classified.complexity = override.complexity;
      _auditLog(query, classified);
      return classified;
    }
  }

  // ── Keyword classifier ──────────────────────────────────────────────────────
  const classified = _keywordClassify(q);
  _auditLog(query, classified);
  return classified;
}

/** @private */
function _keywordClassify(q) {
  // Off-topic check first (fast reject)
  const offTopicHits = countHits(q, OFF_TOPIC_INDICATORS);
  if (offTopicHits > 0) {
    return {
      topic:            'off-topic',
      complexity:       null,
      confidence:       Math.min(0.5 + offTopicHits * 0.2, 1.0),
      method:           'off-topic-indicator',
      rejected:         true,
      rejectionMessage: offTopicMessage(),
    };
  }

  const repoHits    = countHits(q, REPOSITORY_KEYWORDS);
  const umaHits     = countHits(q, UMAMUSUME_KEYWORDS);
  const messageHits = countHits(q, MESSAGE_KEYWORDS);
  const liveHits    = countHits(q, LIVE_KEYWORDS);

  const total = repoHits + umaHits + messageHits + liveHits;

  // No hits at all — fall back to off-topic below confidence threshold
  if (total === 0) {
    return {
      topic:            'off-topic',
      complexity:       null,
      confidence:       0.0,
      method:           'keyword',
      rejected:         true,
      rejectionMessage: offTopicMessage(),
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
  const runnerUp  = scores[1];
  const confidence = total > 0 ? Math.min(0.5 + (winner.hits / total) * 0.5, 1.0) : 0.0;

  // Below confidence threshold → off-topic
  if (confidence < config.topicFilterConfidenceThreshold && winner.hits === 0) {
    return {
      topic:            'off-topic',
      complexity:       null,
      confidence,
      method:           'keyword',
      rejected:         true,
      rejectionMessage: offTopicMessage(),
    };
  }

  const topic = winner.topic;
  const complexity = assignComplexity(topic, q);

  return {
    topic,
    complexity,
    confidence,
    method:           'keyword',
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
    "I'm the Umakraft AI Knowledge Service. I can help with:\n" +
    '• **Repository questions** — ask about any part of the Umakraft codebase\n' +
    '• **Umamusume knowledge** — ask about game mechanics, terms, or circle concepts\n' +
    '• **Live data** — use `/ai live` to ask about current rankings or recent updates\n' +
    '• **Community messages** — use `/ai message` to generate a message\n\n' +
    "I'm not able to help with general questions outside of these topics."
  );
}
