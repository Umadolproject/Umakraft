// AI/ReflectionEngine.js
// Post-generation self-correction — evaluates AI output before delivery.
// If the answer is incomplete, inaccurate, or low-confidence, the engine
// signals the Agent to re-plan with adjusted parameters.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Phase:     Agent Layer (post-Phase 7)
//
// Public API:
//   reflect(answer, context) → ReflectionResult
//     { passed, action, reasons, adjustedPlan }

import log from '../core/log.js';

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const MIN_WORD_COUNT     = 10;   // fewer = probably incomplete
const MAX_RETRY_ATTEMPTS = 2;    // max re-plan + re-generate cycles
const MIN_CONFIDENCE_REFLECT = 0.50; // below this → always re-search

const VAGUE_PHRASES = [
  /I don't know/i,
  /I('m|\s+am) not sure/i,
  /I cannot (answer|help|assist)/i,
  /no (relevant )?information (was |)found/i,
  /unable to (find|locate|retrieve)/i,
  /I don't have (enough|sufficient|any) (information|data|context)/i,
  /please (rephrase|clarify|be more specific)/i,
];

const CONTRADICTION_FLAGS = [
  { pattern: /however,? (according to|the (?:docs|repository|code|source)|based on)/i, label: 'however-contrary-source' },
  { pattern: /but (?:actually|in fact|the truth is)/i,                                       label: 'but-contradiction' },
  { pattern: /that said,? (?:the|this|it)/i,                                                 label: 'that-said-contradiction' },
  { pattern: /on the (?:other|one) hand/i,                                                   label: 'on-the-other-hand' },
  { pattern: /contrary to/i,                                                                  label: 'contrary-to' },
];

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ReflectionResult
 * @property {boolean}   passed        — true if answer can be delivered
 * @property {'send'|'re-search'|'re-phrase'|'reject'} action
 * @property {string[]}  reasons       — why the action was chosen
 * @property {object|null} adjustedPlan — if re-search: which tools to re-run
 */

/**
 * Evaluate a generated answer against quality and safety thresholds.
 * Called by the Agent after AI generation, before delivery.
 *
 * @param {object} input
 * @param {string} input.answer             — AI-generated text
 * @param {string} input.topic              — classification topic
 * @param {number} input.confidence         — 0.0–1.0 from TopicFilter
 * @param {number} input.attempt            — current attempt (1-based)
 * @param {object} input.context            — what the Agent knows about this request
 * @param {string} input.context.query      — original user question
 * @param {string[]} input.context.toolsUsed — which tools ran
 * @param {number} input.context.chunksFound — how many chunks were retrieved
 * @param {boolean} input.context.searchWebAttempted — did we already try web search?
 * @returns {ReflectionResult}
 */
export function reflect({ answer, topic, confidence, attempt, context = {} } = {}) {
  if (!answer || typeof answer !== 'string') {
    return { passed: false, action: 'reject', reasons: ['Empty or non-string answer'], adjustedPlan: null };
  }

  const reasons     = [];
  const wordCount   = answer.split(/\s+/).length;
  const hasWebSearch = context.searchWebAttempted ?? false;

  // ── Check 1: Vague / "I don't know" response ───────────────────────────
  const isVague = VAGUE_PHRASES.some(p => p.test(answer));
  if (isVague && context.chunksFound === 0 && !hasWebSearch) {
    reasons.push('Vague response with zero chunks — try web search');
    return {
      passed: false,
      action: 're-search',
      reasons,
      adjustedPlan: { addTools: ['search_web'], reason: 'no local results, try web' },
    };
  }
  if (isVague && attempt < MAX_RETRY_ATTEMPTS) {
    reasons.push('Vague response — recommend re-search');
    return {
      passed: false,
      action: 're-search',
      reasons,
      adjustedPlan: { addTools: ['search_repository'], reason: 'vague answer, try broader search' },
    };
  }
  if (isVague) {
    reasons.push('Vague response after max attempts');
    return { passed: true, action: 'send', reasons, adjustedPlan: null };
  }

  // ── Check 2: Too short — likely incomplete ─────────────────────────────
  if (wordCount < MIN_WORD_COUNT && context.chunksFound > 0 && attempt < MAX_RETRY_ATTEMPTS) {
    reasons.push(`Response too short (${wordCount} words) despite ${context.chunksFound} source chunks`);
    return {
      passed: false,
      action: 're-phrase',
      reasons,
      adjustedPlan: { retryGeneration: true, reason: `too short (${wordCount} words)` },
    };
  }

  // ── Check 3: Confidence too low ────────────────────────────────────────
  if (confidence < MIN_CONFIDENCE_REFLECT && !hasWebSearch && attempt < MAX_RETRY_ATTEMPTS) {
    reasons.push(`Confidence too low (${Math.round(confidence * 100)}%) — escalate to web search`);
    return {
      passed: false,
      action: 're-search',
      reasons,
      adjustedPlan: { addTools: ['search_web'], reason: `low confidence (${Math.round(confidence * 100)}%)` },
    };
  }

  // ── Check 4: Self-contradiction flags ──────────────────────────────────
  const contradictory = CONTRADICTION_FLAGS.filter(f => f.pattern.test(answer));
  if (contradictory.length >= 2 && attempt < MAX_RETRY_ATTEMPTS) {
    reasons.push(`Self-contradiction flags: ${contradictory.map(m => m.label).join(', ')}`);
    return {
      passed: false,
      action: 're-phrase',
      reasons,
      adjustedPlan: { retryGeneration: true, reason: 'self-contradiction detected' },
    };
  }

  // ── Check 5: Repository answer without source chunks ───────────────────
  if (topic === 'repository' && context.chunksFound === 0 && !hasWebSearch && attempt < MAX_RETRY_ATTEMPTS) {
    reasons.push('Repository answer with zero chunks — try web search');
    return {
      passed: false,
      action: 're-search',
      reasons,
      adjustedPlan: { addTools: ['search_web'], reason: 'no repository results found' },
    };
  }

  // ── All checks passed ──────────────────────────────────────────────────
  if (reasons.length === 0) {
    reasons.push('All reflection checks passed');
  }

  log.info(
    `[AI/ReflectionEngine] Reflect passed — topic=${topic} ` +
    `confidence=${Math.round(confidence * 100)}% ` +
    `words=${wordCount} chunks=${context.chunksFound ?? 0} ` +
    `reasons=${reasons.join('; ')}`
  );

  return { passed: true, action: 'send', reasons, adjustedPlan: null };
}

/**
 * Quick pre-check: should we even attempt to generate an answer?
 * Used by the Planner before calling the AI model.
 *
 * @param {{ confidence: number, rejected: boolean, topic: string }} classification
 * @returns {{ proceed: boolean, reason?: string }}
 */
export function shouldGenerate(classification) {
  if (classification.rejected) {
    return { proceed: false, reason: 'off-topic — rejected by TopicFilter' };
  }
  if (classification.topic === 'message') {
    return { proceed: true }; // message generation bypasses AI
  }
  return { proceed: true };
}

/**
 * Determine if a re-search cycle is worth it given the attempt count and
 * available tools.
 *
 * @param {number} attempt
 * @param {number} maxAttempts
 * @param {string[]} toolsTried
 * @returns {boolean}
 */
export function shouldRetry(attempt, maxAttempts, toolsTried = []) {
  if (attempt >= maxAttempts) return false;
  // If we've tried all major search tools already, stop
  const triedSearch = toolsTried.some(t => t.startsWith('search_'));
  const triedWeb    = toolsTried.includes('search_web');
  if (triedSearch && triedWeb) return false;
  return true;
}
