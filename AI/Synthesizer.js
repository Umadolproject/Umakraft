'use strict';

import log from '../core/log.js';

/**
 * Synthesizer — transforms raw web search snippets into clean,
 * confidence-ranked facts before the LLM sees them.
 *
 * Runs in-process (no extra LLM calls), ~1-5ms per question.
 *
 * Pipeline:
 *   raw snippets → normalize → filter junk → score → rank → budget → facts[]
 *
 * No semantic dedup: bag-of-words (Jaccard, TF-IDF) cannot distinguish
 * "Kitasan Black is the best" from "Fine Motion is an alternative" when
 * both share the same question-topic tokens. The LLM handles semantic
 * dedup naturally — our job is to filter noise and present a clean,
 * ranked, budget-capped fact set.
 */

// ── Constants ──────────────────────────────────────────────────────────────

const MIN_FACT_LENGTH = 25;
const HIGH_CONFIDENCE = 0.75;
const LOW_CONFIDENCE  = 0.30;

// ── Stop words ─────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'it', 'its', 'this',
  'that', 'these', 'those', 'of', 'in', 'to', 'for', 'with', 'on', 'at',
  'by', 'from', 'as', 'into', 'about', 'like', 'through', 'after', 'before',
  'between', 'under', 'over', 'and', 'but', 'or', 'not', 'no', 'nor',
  'so', 'than', 'too', 'very', 'just', 'also', 'then', 'now', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'few', 'more', 'most', 'some', 'any', 'such', 'only', 'other',
]);

// ── Budget by intent ───────────────────────────────────────────────────────

export const BUDGET = {
  definition:   { maxFacts: 2, maxWords: 120 },
  general:      { maxFacts: 3, maxWords: 180 },
  comparison:   { maxFacts: 5, maxWords: 300 },
  'how-to':     { maxFacts: 4, maxWords: 250 },
  repository:   { maxFacts: 3, maxWords: 300 },
  knowledge:    { maxFacts: 3, maxWords: 200 },
  web:          { maxFacts: 4, maxWords: 250 },
  default:      { maxFacts: 3, maxWords: 180 },
};

// ── Junk patterns ──────────────────────────────────────────────────────────

const JUNK_PATTERNS = [
  /^(click|tap|learn more|read more|find out|discover|explore|check out)\b/i,
  /^\d{1,2}\s*(min read|minutes? ago|hours? ago|days? ago)/i,
  /\b(sign up|subscribe|newsletter|advertisement|sponsored)\b/i,
  /\b(cookie|privacy policy|terms of service|accept all)\b/i,
  /\b(all rights reserved|copyright ©?\s*\d{4})\b/i,
  /^(search results?|showing results?|we found)\b/i,
];

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * @param {Object}  params
 * @param {string}  params.question
 * @param {string[]}params.snippets
 * @param {string}  [params.intent]
 * @param {number}  [params.maxFacts]
 */
export function synthesize({ question, snippets, intent = 'general', maxFacts }) {
  if (!snippets || snippets.length === 0) {
    return empty(BUDGET[intent] || BUDGET.default);
  }

  const budget = BUDGET[intent] || BUDGET.default;
  const rawCount = snippets.length;

  // 1. Normalize & filter junk
  let facts = snippets
    .map(s => normalize(s))
    .filter(f => f.length >= MIN_FACT_LENGTH)
    .filter(f => !looksLikeJunk(f))
    .map((text, i) => ({ id: i, text, tokens: tokenize(text) }));

  if (facts.length === 0) return empty(budget);

  // 2. Score relevance to question + short-fact penalty
  facts = scoreConfidence(facts, question);

  // 3. Remove low-confidence facts
  facts = facts.filter(f => f.confidence >= LOW_CONFIDENCE);

  // 4. Rank by confidence (highest first)
  facts.sort((a, b) => b.confidence - a.confidence);

  // 5. Budget cap
  const limit = maxFacts || budget.maxFacts;
  facts = facts.slice(0, limit);

  const isHigh = facts.length > 0 && facts.every(f => f.confidence >= HIGH_CONFIDENCE);

  log.info(
    `[Synthesizer] ${rawCount} raw → ${facts.length} ranked facts ` +
    `(${isHigh ? 'high' : 'mixed'} confidence, intent: ${intent}, budget: ≤${budget.maxWords}w)`
  );

  return {
    facts: facts.map(f => ({
      text: f.text,
      confidence: f.confidence,
      sourceCount: 1,
    })),
    budget,
    isHighConfidence: isHigh,
  };
}

function empty(budget) {
  return { facts: [], budget, isHighConfidence: false };
}

// ── Normalize ──────────────────────────────────────────────────────────────

function normalize(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/^[^a-zA-Z0-9]*/, '')
    .trim();
}

// ── Tokenize ───────────────────────────────────────────────────────────────

function tokenize(text) {
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9 \-]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w))
  );
}

// ── Confidence scoring ─────────────────────────────────────────────────────

function scoreConfidence(facts, question) {
  const questionTokens = tokenize(question);

  for (const fact of facts) {
    const overlap = [...questionTokens].filter(t => fact.tokens.has(t));
    const relevance = questionTokens.size > 0
      ? overlap.length / questionTokens.size
      : 0.5;

    // Small penalty for very short facts
    const lenRatio = fact.text.length / MIN_FACT_LENGTH;
    const lenPenalty = Math.max(0, (1 - Math.min(lenRatio, 2) / 2) * 0.10);

    fact.confidence = Math.round(
      Math.max(0.10, Math.min(0.98, relevance - lenPenalty)) * 100
    ) / 100;
  }

  return facts;
}

// ── Junk detection ─────────────────────────────────────────────────────────

function looksLikeJunk(text) {
  return JUNK_PATTERNS.some(p => p.test(text));
}

// ── Format for LLM prompt ──────────────────────────────────────────────────

/**
 * Format ranked facts into a compact prompt block.
 *
 * @param {ReturnType<typeof synthesize>} result
 * @returns {string}
 */
export function formatForPrompt(result) {
  if (result.facts.length === 0) return '';

  const { facts, budget, isHighConfidence } = result;

  const confLabel = isHighConfidence
    ? 'high-confidence'
    : 'mixed confidence — cross-check if uncertain';

  const lines = [
    `[Ranked knowledge (${facts.length} facts, ${confLabel}, ≤${budget.maxWords} words):]`,
    ...facts.map(f =>
      `  • [${Math.round(f.confidence * 100)}%] ${f.text}`
    ),
    '',
    'IMPORTANT: Do NOT list sources inline. Do NOT say "According to...". ' +
    'Synthesize these facts naturally into one cohesive answer.',
  ];

  return lines.join('\n');
}
