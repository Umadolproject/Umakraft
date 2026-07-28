// AI/managers/UserProfileManager.js
// User Profile Manager — builds per-user profiles from conversation history.
// Extracts facts, learns from corrections, and adjusts response relevance
// over time based on what the user has taught the bot.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Chapter:  07 — Learning & Experience
// Phase:    Agent Layer (Phase 8)
//
// Memory tiers:
//   core      — essential facts ("my horse is Gold Ship"), never auto-decay
//   working   — recent interactions, decay after 7 days of inactivity
//   ephemeral — one-off context, cleared after session
//
// Public API:
//   getProfile(userId)                  → UserProfile
//   extractFacts(query, userId)         → ExtractedFact[]
//   learnCorrection(userId, correction) → void
//   updateFromInteraction(userId, query, response, topic) → void
//   enrichPrompt(prompt, userId)         → string (with profile context)
//   summarizeProfile(userId)             → string (for context injection)

import log from '../../core/log.js';

// ──────────────────────────────────────────────────────────────────────────────
// In-memory profile store (fast access, rebuilds on restart)
// ──────────────────────────────────────────────────────────────────────────────

/** @type {Map<string, UserProfile>} */
const _profiles = new Map();

// ──────────────────────────────────────────────────────────────────────────────
// Fact extraction patterns
// ──────────────────────────────────────────────────────────────────────────────

const FACT_PATTERNS = [
  // Possessive patterns: "my X is Y", "my X are Y"
  // Captures both key (group 1) and value (group 2) — we use value
  { regex: /my\s+(\w[\w\s]{0,40})\s+(?:is|are)\s+(?:a\s+|an\s+|the\s+)?([\w\s.,!?-]{2,60})/gi, category: 'fact', valueIndex: 2 },
  // "I use X", "I'm using X"
  { regex: /i(?:\s+|'m\s+)using\s+([\w\s]{2,50})/gi, category: 'usage' },
  // "I am at rank X", "I'm rank X", "my rank is X" — handles "I am at", "I'm at", "my"
  { regex: /(?:i\s+(?:am\s+)?(?:at\s+)?|i'm\s+(?:at\s+)?|my\s+)rank\s+(?:is\s+)?([A-Za-z0-9]+)/gi, category: 'rank' },
  // "I have X", "I've got X"
  { regex: /i(?:\s+|'ve\s+got\s+|have\s+)([\w\s]{2,50})/gi, category: 'fact' },
  // "my circle is X", "my circle's name is X"
  { regex: /my\s+circle(?:\s+name)?\s+(?:is\s+)?([\w\s]{2,40})/gi, category: 'circle' },
  // "I main X" (character)
  { regex: /i\s+main\s+([\w\s]{2,40})/gi, category: 'preference' },
  // "my main horse is X"
  { regex: /my\s+main\s+(?:horse|girl|uma|character)\s+is\s+([\w\s]{2,40})/gi, category: 'character' },
  // Trainer name: "I'm TrainerX", "my trainer name is X"
  { regex: /(?:i'm|i\s+am|my\s+trainer\s+(?:name|id)\s+is)\s+(?:trainer\s*)?([\w]{2,30})/gi, category: 'identity' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Correction detection patterns
// ──────────────────────────────────────────────────────────────────────────────

const CORRECTION_PATTERNS = [
  /no[,.\s]+(?:that'?s?\s+)?(?:wrong|incorrect|not\s+right|not\s+correct|not\s+true)/i,
  /that'?s?\s+(?:wrong|incorrect|not\s+right|not\s+true|false)/i,
  /actually[,.\s]+/i,
  /(?:you'?re?|you\s+are)\s+wrong/i,
  /i\s+meant\s+/i,
  /that\s+isn'?t?\s+(?:right|correct|true|what\s+i\s+(?:asked|meant|wanted))/i,
  /(?:no|nope)[,.\s]+(?:it'?s?|that'?s?|the\s+answer\s+is)\s+/i,
];

// ──────────────────────────────────────────────────────────────────────────────
// UserProfile
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {object} ExtractedFact
 * @property {string} fact       — the extracted fact text
 * @property {string} category   — 'fact' | 'usage' | 'rank' | 'circle' | 'preference' | 'character' | 'identity'
 * @property {string} tier       — 'core' | 'working'
 * @property {number} confidence — 0.0–1.0
 * @property {number} timestamp  — unix ms when extracted
 * @property {number} reinforced — how many times user confirmed/repeated this
 */

/**
 * @typedef {object} UserProfile
 * @property {string} userId
 * @property {ExtractedFact[]} facts
 * @property {string[]} corrections      — previous bot answers the user corrected
 * @property {number} interactionCount
 * @property {number} lastSeenAt
 * @property {string[]} commonTopics     — top 3 most common topics
 * @property {object} topicCounts        — { [topic]: count }
 */

function createProfile(userId) {
  return {
    userId,
    facts: [],
    corrections: [],
    interactionCount: 0,
    lastSeenAt: Date.now(),
    commonTopics: [],
    topicCounts: {},
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Fact extraction
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Extract facts from a user query using pattern matching.
 *
 * @param {string} query  — user's message
 * @param {string} userId
 * @returns {ExtractedFact[]}
 */
export function extractFacts(query, userId) {
  const facts = [];
  const now = Date.now();

  for (const pattern of FACT_PATTERNS) {
    // Reset regex state
    pattern.regex.lastIndex = 0;
    let match;
    while ((match = pattern.regex.exec(query)) !== null) {
      const index = pattern.valueIndex ?? 1;
      const extracted = (match[index] ?? '').trim();
      // Filter out noise — facts should be at least 2 chars and contain at least one letter
      if (extracted.length < 2 || !/[a-zA-Z]/.test(extracted)) continue;
      // Filter out common noise phrases
      if (/^(a|an|the|to|it|in|on|at|of|for|is|are|was|were|been|be|this|that|these|those)$/i.test(extracted)) continue;

      facts.push({
        fact: extracted,
        category: pattern.category,
        tier: 'core', // direct user statements are core facts
        confidence: 0.90,
        timestamp: now,
        reinforced: 0,
      });
    }
  }

  if (facts.length > 0) {
    log.info(`[UserProfile] Extracted ${facts.length} fact(s) from user ${userId}: ${facts.map(f => `${f.category}=${f.fact}`).join(', ')}`);
  }

  return facts;
}

// ──────────────────────────────────────────────────────────────────────────────
// Correction learning
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Detect if a user message is a correction of the bot's previous answer.
 *
 * @param {string} query — user's message
 * @returns {boolean}
 */
export function isCorrection(query) {
  return CORRECTION_PATTERNS.some(p => p.test(query));
}

/**
 * Record a correction. Decrease confidence of related facts and store
 * the correction text for future avoidance.
 *
 * @param {string} userId
 * @param {string} correctionText — the correction message text
 */
export function learnCorrection(userId, correctionText) {
  const profile = _profiles.get(userId) ?? createProfile(userId);
  profile.corrections.push(correctionText);
  // Keep only last 20 corrections
  if (profile.corrections.length > 20) profile.corrections = profile.corrections.slice(-20);
  _profiles.set(userId, profile);
  log.info(`[UserProfile] Learned correction from user ${userId}: "${correctionText.slice(0, 100)}"`);
}

// ──────────────────────────────────────────────────────────────────────────────
// Interaction update
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Update the user profile after each interaction.
 * Extracts facts from the query, increments counters, and updates topic stats.
 *
 * @param {string} userId
 * @param {string} query      — user's message
 * @param {string} response   — bot's answer
 * @param {string} topic      — classification topic
 */
export function updateFromInteraction(userId, query, response, topic) {
  const profile = _profiles.get(userId) ?? createProfile(userId);

  // Extract facts
  const newFacts = extractFacts(query, userId);
  for (const fact of newFacts) {
    // Check if we already know this — reinforce instead of duplicating
    const existing = profile.facts.find(f =>
      f.category === fact.category &&
      f.fact.toLowerCase() === fact.fact.toLowerCase()
    );
    if (existing) {
      existing.reinforced += 1;
      existing.timestamp = Date.now();
      existing.confidence = Math.min(existing.confidence + 0.05, 1.0);
    } else {
      profile.facts.push(fact);
    }
  }

  // Prune: keep last 50 facts, prioritize core tier
  if (profile.facts.length > 50) {
    const core = profile.facts.filter(f => f.tier === 'core');
    const working = profile.facts.filter(f => f.tier === 'working');
    profile.facts = [...core.slice(-30), ...working.slice(-20)];
  }

  // Detect corrections
  if (isCorrection(query)) {
    learnCorrection(userId, query);
    // Decrease confidence of recent facts that might be wrong
    for (const fact of profile.facts.slice(-5)) {
      fact.confidence = Math.max(fact.confidence - 0.15, 0.3);
    }
  }

  // Update counters
  profile.interactionCount += 1;
  profile.lastSeenAt = Date.now();
  profile.topicCounts[topic] = (profile.topicCounts[topic] ?? 0) + 1;

  // Recompute common topics
  const sorted = Object.entries(profile.topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  profile.commonTopics = sorted.map(([t]) => t);

  _profiles.set(userId, profile);
}

// ──────────────────────────────────────────────────────────────────────────────
// Profile access
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get (or create) a user profile.
 * @param {string} userId
 * @returns {UserProfile}
 */
export function getProfile(userId) {
  if (!_profiles.has(userId)) {
    const profile = createProfile(userId);
    _profiles.set(userId, profile);
    return profile;
  }
  return _profiles.get(userId);
}

// ──────────────────────────────────────────────────────────────────────────────
// Memory tiering & decay
// ──────────────────────────────────────────────────────────────────────────────

const WORKING_DECAY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const DECAY_RATE_PER_DAY = 0.05; // 5% per day

/**
 * Apply temporal decay to working-tier facts. Core facts are immune.
 * Called periodically or on profile access.
 *
 * @param {string} userId
 */
export function applyDecay(userId) {
  const profile = _profiles.get(userId);
  if (!profile) return;

  const now = Date.now();
  for (const fact of profile.facts) {
    if (fact.tier === 'core') continue; // core facts never decay

    const daysSinceUpdate = (now - fact.timestamp) / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate > 7) {
      const decayAmount = DECAY_RATE_PER_DAY * (daysSinceUpdate - 7);
      fact.confidence = Math.max(fact.confidence - decayAmount, 0.2);

      // Demote to ephemeral if confidence drops too low
      if (fact.confidence < 0.35) {
        fact.tier = 'ephemeral';
      }
    }
  }

  // Remove ephemeral facts with very low confidence
  profile.facts = profile.facts.filter(f =>
    !(f.tier === 'ephemeral' && f.confidence < 0.25)
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Memory summarization for context injection
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate a compact profile summary for context injection into prompts.
 *
 * @param {string} userId
 * @returns {string}
 */
export function summarizeProfile(userId) {
  const profile = getProfile(userId);
  applyDecay(userId);

  const parts = [];

  // Character / identity facts
  const identityFacts = profile.facts.filter(f =>
    ['character', 'identity', 'circle', 'rank'].includes(f.category) &&
    f.tier !== 'ephemeral'
  );
  if (identityFacts.length > 0) {
    const lines = identityFacts.slice(0, 5).map(f =>
      `- ${f.category}: ${f.fact} (confidence: ${f.confidence.toFixed(2)})`
    );
    parts.push(`[Known about this user:]\n${lines.join('\n')}`);
  }

  // Common topics
  if (profile.commonTopics.length > 0) {
    parts.push(`[User's common topics: ${profile.commonTopics.join(', ')}]`);
  }

  // Correction history (truncated)
  if (profile.corrections.length > 0) {
    const recent = profile.corrections.slice(-3).map(c => `- "${c.slice(0, 80)}"`);
    parts.push(`[User has corrected the bot ${profile.corrections.length} time(s):\n${recent.join('\n')}]`);
  }

  return parts.length > 0 ? `\n\n[User Profile Context — use this to personalize the response:]\n${parts.join('\n\n')}` : '';
}

// ──────────────────────────────────────────────────────────────────────────────
// Prompt enrichment
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Add user profile context to a prompt before sending to AI.
 *
 * @param {string} prompt   — assembled prompt
 * @param {string} userId
 * @returns {string} enriched prompt
 */
export function enrichPrompt(prompt, userId) {
  if (!userId) return prompt;

  const summary = summarizeProfile(userId);
  if (!summary) return prompt;

  // Inject after the main prompt but before the question
  const enriched = `${prompt}${summary}`;
  if (enriched.length > 8000) {
    // Truncate profile summary to fit
    const maxProfile = 8000 - prompt.length - 50;
    return `${prompt}${summary.slice(0, maxProfile)}`;
  }
  return enriched;
}

// ──────────────────────────────────────────────────────────────────────────────
// Stats & monitoring
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @returns {{ profiles: number, totalFacts: number, totalInteractions: number }}
 */
export function stats() {
  let totalFacts = 0;
  let totalInteractions = 0;
  for (const profile of _profiles.values()) {
    totalFacts += profile.facts.length;
    totalInteractions += profile.interactionCount;
  }
  return {
    profiles: _profiles.size,
    totalFacts,
    totalInteractions,
  };
}

log.info('[UserProfileManager] Initialized — fact extraction + correction learning + memory tiering');
