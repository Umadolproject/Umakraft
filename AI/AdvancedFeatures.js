// AI/AdvancedFeatures.js
// Phase 7 — Advanced Features
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Plan:      AI/IMPLEMENTATION_PLAN.md (Phase 7)
//
// Four capabilities:
//   1. ConversationMemory   — short-term session context across turns
//   2. CitationMode         — user-facing citation toggle + formatting
//   3. ConfidenceScore      — report retrieval confidence in every answer
//   4. MultiLanguage        — detect user language + respond in-kind
//
// Public API:
//   ConversationMemory.add(sessionId, turn)   — store a turn in memory
//   ConversationMemory.get(sessionId)         — retrieve session context
//   ConversationMemory.clear(sessionId)       — forget a session
//   ConversationMemory.prune()                — evict expired sessions
//
//   CitationMode.isEnabled(userId)           — check if citation mode is on
//   CitationMode.toggle(userId)              — toggle citation mode for a user
//   CitationMode.format(text, citations)     — format citations for display
//
//   ConfidenceScore.format(score, topic)     — format confidence for user display
//
//   MultiLanguage.detect(text)               — detect the user's language
//   MultiLanguage.instructionForResponse(lang) — returns a prompt suffix

import { createHash } from 'node:crypto';

// ──────────────────────────────────────────────────────────────────────────────
// PART 1 — Conversation Memory
// ──────────────────────────────────────────────────────────────────────────────

/**
 * In-memory session store. A "session" is keyed by Discord channel ID × user ID,
 * which naturally scopes to the relevant conversation context.
 *
 * TTL: 30 minutes of inactivity. Pruned on every add().
 *
 * @typedef {Object} MemoryTurn
 * @property {string} query      — user question
 * @property {string} response   — AI response (truncated to 500 chars for storage)
 * @property {number} recordedAt — Date.now()
 */

/** @type {Map<string, MemoryTurn[]>} */
const _sessions = new Map();

/** Session TTL in ms — turns older than this are evicted on prune */
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** Max turns per session — beyond this, oldest turns are dropped */
const MAX_TURNS_PER_SESSION = 5;

function sessionKey(userId, channelId) {
  return `${channelId ?? 'dm'}:${userId}`;
}

/**
 * Store a conversation turn in session memory.
 *
 * @param {string} userId
 * @param {string} channelId
 * @param {string} query       — the user's question
 * @param {string} response    — the AI's answer (truncated to 500 chars)
 */
export function addConversationTurn(userId, channelId, query, response) {
  if (!userId || !query) return;

  const key = sessionKey(userId, channelId);
  let turns = _sessions.get(key);
  if (!turns) {
    turns = [];
    _sessions.set(key, turns);
  }

  turns.push({
    query,
    response: typeof response === 'string' ? response.slice(0, 500) : '',
    recordedAt: Date.now(),
  });

  // Truncate to max turns
  if (turns.length > MAX_TURNS_PER_SESSION) {
    turns.splice(0, turns.length - MAX_TURNS_PER_SESSION);
  }

  // Prune stale sessions
  pruneConversations();

  // ── Persist to Turso (fire-and-forget, never blocks the hot path) ──
  (async () => {
    try {
      await global.__learningManager?.memory?.storeConversation({
        userId, channelId, query,
        response: typeof response === 'string' ? response.slice(0, 500) : '',
        guildId: global.__currentGuildId,
      });
    } catch { /* best-effort */ }
  })();
}

/**
 * Build a context string from recent conversation turns for injection into
 * the prompt. Returns "" if there is no relevant history.
 *
 * @param {string} userId
 * @param {string} channelId
 * @returns {string}
 */
export function getConversationContext(userId, channelId) {
  const key = sessionKey(userId, channelId);
  const turns = _sessions.get(key);
  if (!turns || turns.length === 0) return '';

  const now = Date.now();
  const recent = turns.filter(t => (now - t.recordedAt) < SESSION_TTL_MS);
  if (recent.length === 0) return '';

  const lines = ['[Previous conversation in this session:']; // closes below
  for (const t of recent) {
    lines.push(`  User: ${t.query.slice(0, 200)}`);
    lines.push(`  Umakraft: ${t.response.slice(0, 300)}`);
  }
  lines.push('] — End of conversation history');

  return lines.join('\n');
}

/**
 * Clear all turns for a given user+channel session.
 *
 * @param {string} userId
 * @param {string} channelId
 */
export function clearConversation(userId, channelId) {
  _sessions.delete(sessionKey(userId, channelId));

  // ── Also clear from Turso (fire-and-forget) ──
  (async () => {
    try {
      await global.__learningManager?.memory?.clearConversations(userId, channelId);
    } catch { /* best-effort */ }
  })();
}

/**
 * Evict sessions older than SESSION_TTL_MS.
 */
export function pruneConversations() {
  const now = Date.now();
  for (const [key, turns] of _sessions) {
    const filtered = turns.filter(t => (now - t.recordedAt) < SESSION_TTL_MS);
    if (filtered.length === 0) {
      _sessions.delete(key);
    } else {
      _sessions.set(key, filtered);
    }
  }
}

/**
 * Return the current session count for monitoring.
 * @returns {number}
 */
export function activeSessionCount() {
  pruneConversations();
  return _sessions.size;
}

/**
 * Preload recent conversation turns from Turso into the in-memory Map.
 * Call once on startup so getConversationContext() has data immediately.
 * Fire-and-forget — failure silently leaves the Map empty (acceptable).
 *
 * @returns {Promise<void>}
 */
export async function preloadConversations() {
  const memory = global.__learningManager?.memory;
  if (!memory?.getTurso()) return;

  try {
    // Load ALL recent conversations (last 30min) — the getConversations
    // method already enforces the TTL via SQL WHERE recorded_at > cutoff.
    // We load all user+channel pairs from the DB and hydrate them.
    const turso = memory.getTurso();
    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { rows } = await turso.execute({
      sql: `SELECT user_id, channel_id, query, response, recorded_at
            FROM conversations
            WHERE recorded_at > ?
            ORDER BY recorded_at ASC`,
      args: [cutoff],
    });

    let loaded = 0;
    for (const row of rows) {
      const key = sessionKey(row.user_id, row.channel_id);
      let turns = _sessions.get(key);
      if (!turns) {
        turns = [];
        _sessions.set(key, turns);
      }
      turns.push({
        query: row.query,
        response: row.response,
        recordedAt: new Date(row.recorded_at).getTime(),
      });
      // Enforce max turns per session
      if (turns.length > MAX_TURNS_PER_SESSION) {
        turns.splice(0, turns.length - MAX_TURNS_PER_SESSION);
      }
      loaded++;
    }

    if (loaded > 0) {
      const sessions = _sessions.size;
      console.log(`[AdvancedFeatures] Preloaded ${loaded} conversation turns across ${sessions} sessions`);
    }
  } catch (err) {
    console.warn('[AdvancedFeatures] Conversation preload failed (non-fatal):', err?.message ?? err);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 2 — Citation Mode
// ──────────────────────────────────────────────────────────────────────────────

/** @type {Set<string>} user IDs that have citation mode enabled */
const _citationUsers = new Set();

/**
 * Check if citation mode is enabled for this user.
 * @param {string} userId
 * @returns {boolean}
 */
export function isCitationModeEnabled(userId) {
  return _citationUsers.has(userId);
}

/**
 * Toggle citation mode on/off for this user.
 * Returns the new state.
 *
 * @param {string} userId
 * @returns {boolean} new state
 */
export function toggleCitationMode(userId) {
  if (_citationUsers.has(userId)) {
    _citationUsers.delete(userId);
    return false;
  }
  _citationUsers.add(userId);
  return true;
}

/**
 * Format a response with optional citations appended.
 * Citations are always shown for repository topics; citation-mode users
 * get them for all topic types.
 *
 * @param {string}      text        — AI response text
 * @param {string[]}    citations   — list of source references
 * @param {string}      topic       — classification (repository|umamusume|live|message)
 * @param {string|null} userId      — Discord user ID (for citation mode check)
 * @returns {string}
 */
export function formatWithCitations(text, citations = [], topic = '', userId = null) {
  if (!citations || citations.length === 0) return text;

  const shouldShow = topic === 'repository' || (userId && isCitationModeEnabled(userId));
  if (!shouldShow) return text;

  const sourceList = citations
    .slice(0, 8)
    .map(c => `\`${c}\``)
    .join(', ');

  return `${text}\n\n**Sources:** ${sourceList}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 3 — Confidence Score
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Format a confidence score for display in the user's answer.
 *
 * Confidence bands:
 *   ≥ 0.90 → "Very high confidence"
 *   ≥ 0.75 → "High confidence"
 *   ≥ 0.60 → "Moderate confidence"
 *   ≥ 0.40 → "Low confidence"
 *   < 0.40 → "Low confidence — consider rephrasing"
 *
 * @param {number} score   — 0.0–1.0 from TopicFilter.classify().confidence
 * @param {string} topic   — classification topic
 * @returns {string}
 */
export function formatConfidence(score, topic) {
  if (typeof score !== 'number' || score < 0 || score > 1) return '';

  const pct = Math.round(score * 100);
  let label;
  if (score >= 0.90) label = 'Very high confidence';
  else if (score >= 0.75) label = 'High confidence';
  else if (score >= 0.60) label = 'Moderate confidence';
  else if (score >= 0.40) label = 'Low confidence';
  else label = 'Low confidence — consider rephrasing';

  const source = topic === 'web' || topic === 'live'
    ? 'web search'
    : topic === 'umamusume'
      ? 'knowledge base'
      : 'repository';

  return `\n\n— *${label} (${pct}%, ${source})*`;
}

// ──────────────────────────────────────────────────────────────────────────────
// PART 4 — Multi-Language Support
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Language detection: returns the detected language code or 'en' as default.
 *
 * Uses a lightweight character/word heuristic — no external library needed.
 * Supports English, Japanese, Spanish, French, German, Portuguese,
 * Russian, Chinese (Simplified), Korean.
 *
 * @param {string} text
 * @returns {{ lang: string, confidence: number }}
 */
export function detectLanguage(text) {
  if (!text || text.trim().length === 0) return { lang: 'en', confidence: 0.0 };

  const t = text.trim();
  let scores = { en: 0, ja: 0, es: 0, fr: 0, de: 0, pt: 0, ru: 0, zh: 0, ko: 0 };
  const total = t.length;

  // Japanese: hiragana + katakana + CJK unified (with JP-specific nuance)
  const jaCount = (t.match(/[\u3040-\u309F\u30A0-\u30FF]/g) ?? []).length;
  scores.ja = jaCount / total;

  // Korean: hangul
  const koCount = (t.match(/[\uAC00-\uD7AF]/g) ?? []).length;
  scores.ko = koCount / total;

  // Chinese (Simplified): CJK but no hiragana/katakana
  const cjkCount = (t.match(/[\u4E00-\u9FFF]/g) ?? []).length;
  if (cjkCount > 0 && scores.ja < 0.05 && scores.ko < 0.05) {
    scores.zh = cjkCount / total;
  }

  // Cyrillic → Russian
  const cyrillicCount = (t.match(/[\u0400-\u04FF]/g) ?? []).length;
  scores.ru = cyrillicCount / total;

  // Latin-based: use stop-word signatures
  const lower = t.toLowerCase();

  const LANG_SIGNATURES = {
    es: ['que', 'los', 'las', 'una', 'para', 'por', 'como', 'más', 'pero'],
    fr: ['que', 'les', 'des', 'une', 'pour', 'dans', 'pas', 'plus', 'avec', 'sur'],
    de: ['der', 'die', 'das', 'und', 'ist', 'nicht', 'mit', 'auf', 'für', 'von'],
    pt: ['que', 'não', 'uma', 'para', 'com', 'dos', 'das', 'mais', 'como', 'está', 'muito', 'aqui'],
    en: ['the', 'what', 'how', 'does', 'use', 'from', 'that', 'this', 'with', 'and', 'for'],
  };

  for (const [lang, words] of Object.entries(LANG_SIGNATURES)) {
    const matches = words.filter(w => {
      const re = new RegExp(`\\b${w}\\b`, 'gi');
      return re.test(t);
    }).length;
    scores[lang] = matches / words.length;
  }

  // Portuguese / Spanish tiebreaker — both score similarly on stopwords.
  // Check for Portuguese-specific diacritics / words that don't appear in Spanish.
  const ptSpecific = /\b(não|você|está|muito|aqui|obrigad[oa]|bem-vindo|parabéns|ficou|também)\b/i;
  if (ptSpecific.test(t)) scores.pt = Math.max(scores.pt, 0.4);

  // Spanish-specific diacritics
  const esSpecific = /\b(¿|año|también|estáis|vosotros|vosotras|habéis)\b/i;
  if (esSpecific.test(t)) scores.es = Math.max(scores.es, 0.4);

  // Find winning language
  let bestLang = 'en';
  let bestScore = 0;
  for (const [lang, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
    }
  }

  return { lang: bestLang, confidence: Math.min(bestScore, 1.0) };
}

/**
 * Return a language instruction suffix for the prompt system.
 * When appended to a prompt, tells the AI to respond in the detected language.
 *
 * @param {string} langCode  — ISO 639-1 code from detectLanguage()
 * @returns {string}  prompt suffix instructing the AI to use that language
 */
export function instructionForLanguage(langCode) {
  const MAP = {
    en: '',
    ja: '\n\nRespond in Japanese (日本語) using polite form (です・ます調).',
    es: '\n\nRespond in Spanish (español).',
    fr: '\n\nRespond in French (français).',
    de: '\n\nRespond in German (Deutsch).',
    pt: '\n\nRespond in Portuguese (português).',
    ru: '\n\nRespond in Russian (русский).',
    zh: '\n\nRespond in Simplified Chinese (简体中文).',
    ko: '\n\nRespond in Korean (한국어).',
  };
  return MAP[langCode] ?? '';
}

// ──────────────────────────────────────────────────────────────────────────────
// Stats for monitoring
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Export aggregate stats for AIObserver compatibility.
 * @returns {object}
 */
export function getAdvancedStats() {
  return {
    conversationMemory: {
      activeSessions: activeSessionCount(),
      maxTurnsPerSession: MAX_TURNS_PER_SESSION,
      ttlMinutes: SESSION_TTL_MS / 60_000,
    },
    citationMode: {
      enabledUsers: _citationUsers.size,
    },
  };
}
