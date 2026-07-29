'use strict';

import log from '../core/log.js';

/**
 * Synthesizer -- transforms raw web search snippets into clean,
 * confidence-ranked facts before the LLM sees them.
 *
 * Runs in-process (no extra LLM calls), ~1-5 ms per question.
 *
 * Pipeline:
 *   raw snippets -> normalize -> filter junk -> score -> rank -> budget -> facts[]
 *
 * No semantic dedup: bag-of-words (Jaccard, TF-IDF) cannot distinguish
 * "Kitasan Black is the best" from "Fine Motion is an alternative" when
 * both share the same topic tokens. The LLM handles semantic dedup
 * naturally -- our job is to filter noise and present a clean, ranked,
 * budget-capped fact set.
 */

// --- Constants ---

const MIN_FACT_LENGTH = 25;
const HIGH_CONFIDENCE = 0.75;
const LOW_CONFIDENCE  = 0.30;

// --- Stop words ---

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

// --- Budget by intent ---

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

// --- Junk patterns ---

const JUNK_PATTERNS = [
  /^(click|tap|learn more|read more|find out|discover|explore|check out)\b/i,
  /^\d{1,2}\s*(min read|minutes? ago|hours? ago|days? ago)/i,
  /\b(sign up|subscribe|newsletter|advertisement|sponsored)\b/i,
  /\b(cookie|privacy policy|terms of service|accept all)\b/i,
  /\b(all rights reserved|copyright)\b/i,
  /^(search results?|showing results?|we found)\b/i,
];

// --- Public API ---

/**
 * @param {Object}  params
 * @param {string}  params.question
 * @param {string[]}params.snippets
 * @param {string}  [params.intent]
 * @param {number}  [params.maxFacts]
 */
export function synthesize({ question, snippets, intent, maxFacts }) {
  intent = intent || 'general';

  if (!snippets || snippets.length === 0) {
    return empty(BUDGET[intent] || BUDGET.default);
  }

  var budget = BUDGET[intent] || BUDGET.default;
  var rawCount = snippets.length;

  // 1. Normalize & filter junk
  var facts = snippets
    .map(function (s) { return normalize(s); })
    .filter(function (f) { return f.length >= MIN_FACT_LENGTH; })
    .filter(function (f) { return !looksLikeJunk(f); })
    .map(function (text, i) { return { id: i, text: text, tokens: tokenize(text) }; });

  if (facts.length === 0) return empty(budget);

  // 2. Score relevance to question + short-fact penalty
  facts = scoreConfidence(facts, question);

  // 3. Remove low-confidence facts
  facts = facts.filter(function (f) { return f.confidence >= LOW_CONFIDENCE; });

  // 4. Rank by confidence (highest first)
  facts.sort(function (a, b) { return b.confidence - a.confidence; });

  // 5. Budget cap
  var limit = maxFacts || budget.maxFacts;
  facts = facts.slice(0, limit);

  var isHigh = facts.length > 0 && facts.every(function (f) { return f.confidence >= HIGH_CONFIDENCE; });

  log.info(
    '[Synthesizer] ' + rawCount + ' raw -> ' + facts.length + ' ranked facts ' +
    '(' + (isHigh ? 'high' : 'mixed') + ' confidence, intent: ' + intent +
    ', budget: <=' + budget.maxWords + 'w)'
  );

  return {
    facts: facts.map(function (f) {
      return { text: f.text, confidence: f.confidence, sourceCount: 1 };
    }),
    budget: budget,
    isHighConfidence: isHigh,
  };
}

function empty(budget) {
  return { facts: [], budget: budget, isHighConfidence: false };
}

// --- Normalize ---

function normalize(text) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\.{2,}/g, '')
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/^[^a-zA-Z0-9]*/, '')
    .trim();
}

// --- Tokenize ---

function tokenize(text) {
  var tokens = text.toLowerCase()
    .replace(/[^a-z0-9 \-]/g, '')
    .split(/\s+/)
    .filter(function (w) { return w.length > 2 && !STOP_WORDS.has(w); });
  return new Set(tokens);
}

// --- Confidence scoring ---

function scoreConfidence(facts, question) {
  var questionTokens = tokenize(question);
  var qtArr = [];
  questionTokens.forEach(function (t) { qtArr.push(t); });

  for (var i = 0; i < facts.length; i++) {
    var fact = facts[i];
    var overlap = qtArr.filter(function (t) { return fact.tokens.has(t); });
    var relevance = questionTokens.size > 0
      ? overlap.length / questionTokens.size
      : 0.5;

    var lenRatio = fact.text.length / MIN_FACT_LENGTH;
    var lenPenalty = Math.max(0, (1 - Math.min(lenRatio, 2) / 2) * 0.10);

    fact.confidence = Math.round(
      Math.max(0.10, Math.min(0.98, relevance - lenPenalty)) * 100
    ) / 100;
  }

  return facts;
}

// --- Junk detection ---

function looksLikeJunk(text) {
  for (var i = 0; i < JUNK_PATTERNS.length; i++) {
    if (JUNK_PATTERNS[i].test(text)) return true;
  }
  return false;
}

// --- Format for LLM prompt ---

/**
 * Format ranked facts into a compact prompt block.
 *
 * @param {ReturnType<typeof synthesize>} result
 * @returns {string}
 */
export function formatForPrompt(result) {
  if (result.facts.length === 0) return '';

  var facts = result.facts;
  var budget = result.budget;
  var isHighConfidence = result.isHighConfidence;

  var confLabel = isHighConfidence
    ? 'high-confidence'
    : 'mixed confidence -- cross-check if uncertain';

  var lines = [
    '[Ranked knowledge (' + facts.length + ' facts, ' + confLabel +
    ', <=' + budget.maxWords + ' words):]',
  ];

  for (var i = 0; i < facts.length; i++) {
    var f = facts[i];
    lines.push('  - [' + Math.round(f.confidence * 100) + '%] ' + f.text);
  }

  lines.push('');
  lines.push(
    'IMPORTANT: Do NOT list sources inline. Do NOT say "According to...". ' +
    'Synthesize these facts naturally into one cohesive answer.'
  );

  return lines.join('\n');
}
