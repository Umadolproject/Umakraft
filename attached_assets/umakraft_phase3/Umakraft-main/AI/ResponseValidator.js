// AI/ResponseValidator.js
// Final quality and safety gate before any AI-generated response reaches Discord.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/RESPONSE_VALIDATOR.md
//
// Six checks (all run in parallel):
//   1. Scope          — content matches the Topic Filter classification
//   2. Prohibited     — no politics, violence, explicit content, etc.
//   3. Secret pattern — no API keys, tokens, or base64 payloads
//   4. Word count     — 100–150 words for message-type responses
//   5. Citation       — repository responses cite at least one source
//   6. Hallucination  — flags external URLs and unverifiable claims
//
// Public API:
//   validate(responseText, classification, options) → ValidationResult

import log from '../core/log.js';
import config from './Configuration.js';

// ---------------------------------------------------------------------------
// Prohibited content patterns
// ---------------------------------------------------------------------------

const PROHIBITED_PATTERNS = [
  { pattern: /\b(president|prime minister|senator|congress|parliament|election|vote|ballot)\b/i,  label: 'political content' },
  { pattern: /\b(stock price|cryptocurrency|crypto|bitcoin|ethereum|invest|trading|portfolio)\b/i, label: 'financial advice' },
  { pattern: /\b(medical advice|diagnos|symptom|treatment|prescription|dosage|medication)\b/i,    label: 'medical advice' },
  { pattern: /\b(kill|murder|bomb|attack|weapon|violence|threat|hurt|harm)\b/i,                   label: 'violent content' },
  { pattern: /\b(sex|porn|explicit|nude|nsfw|adult content)\b/i,                                  label: 'explicit content' },
  { pattern: /\b(pokemon|fortnite|minecraft|league of legends|valorant|genshin|roblox)\b/i,       label: 'competitor game content' },
];

// ---------------------------------------------------------------------------
// Secret patterns (mirrors AI/Security.js — always runs regardless of config)
// ---------------------------------------------------------------------------

const SECRET_PATTERNS = [
  { pattern: /sk-[A-Za-z0-9]{20,}/,            label: 'OpenAI API key' },
  { pattern: /AIza[A-Za-z0-9_-]{35}/,           label: 'Google API key' },
  { pattern: /Bearer\s+[A-Za-z0-9._\-~+/]{20,}/, label: 'Bearer token' },
  { pattern: /[A-Za-z0-9+/]{40,}={0,2}/,        label: 'Base64 payload' },
  { pattern: /ghp_[A-Za-z0-9]{36}/,             label: 'GitHub PAT' },
];

// ---------------------------------------------------------------------------
// Hallucination indicators
// ---------------------------------------------------------------------------

const HALLUCINATION_PATTERNS = [
  { pattern: /https?:\/\/(?!uma\.moe)[^\s]+/,                              label: 'external URL (non uma.moe)' },
  { pattern: /(?:line|lines?)\s+\d{3,}/i,                                  label: 'specific line number reference' },
  { pattern: /as of (today|right now|currently|the latest version)/i,      label: '"as of today" about code' },
  { pattern: /according to the (?:latest|current|newest) (?:version|docs)/i, label: 'unverifiable version claim' },
];

// ---------------------------------------------------------------------------
// Scope term lists
// ---------------------------------------------------------------------------

const SCOPE_TERMS = {
  repository: [
    'umakraft', 'vault', 'miner', 'courier', 'inspector', 'refinery', 'refiner',
    'compiler', 'depot', 'workshop', 'fabricator', 'draftsman', 'blueprint',
    'terminal', 'broadcast', 'archive', 'announcer', 'distribution', 'dispatcher',
    'coordinator', 'operation', 'governance', 'pipeline', 'stage', 'uma.moe',
    'blueprint', 'source:', 'sources:', 'function', 'module', 'file', 'class',
  ],
  umamusume: [
    'uma musume', 'umamusume', 'pretty derby', 'mant', 'fan gain', 'fan count',
    'circle rank', 'trainer', 'skill card', 'fan deficit', 'milestone',
    'circle', 'horse girl', 'trend', 'ranking',
  ],
  message: [
    // Community messages should NOT contain system-internal content
  ],
};

// ---------------------------------------------------------------------------
// Word count
// ---------------------------------------------------------------------------

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

function checkScope(text, classification) {
  if (!classification || classification === 'live') return 'skip';

  const lower = text.toLowerCase();
  const terms = SCOPE_TERMS[classification] ?? [];

  if (classification === 'message') {
    // Messages must NOT leak system internals
    const leaks = ['api key', 'process.env', 'OPENAI', 'GEMINI', 'qdrant', 'fabricat', 'pipeline'];
    if (leaks.some(l => lower.includes(l.toLowerCase()))) return 'fail';
    return 'pass';
  }

  if (terms.length === 0) return 'skip';
  const matched = terms.some(t => lower.includes(t.toLowerCase()));
  return matched ? 'pass' : 'fail';
}

function checkProhibited(text) {
  for (const { pattern, label } of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) {
      log.warn(`[AI/ResponseValidator] Prohibited content detected: ${label}`);
      return { result: 'fail', reason: `Prohibited content: ${label}` };
    }
  }
  return { result: 'pass', reason: null };
}

function checkSecrets(text) {
  for (const { pattern, label } of SECRET_PATTERNS) {
    if (pattern.test(text)) {
      log.error(`[AI/ResponseValidator] Secret pattern detected: ${label}`);
      return { result: 'fail', reason: `Secret pattern: ${label}` };
    }
  }
  return { result: 'pass', reason: null };
}

function checkWordCount(text, classification) {
  if (classification !== 'message') return { result: 'skip', wordCount: null, reason: null };
  const count = countWords(text);
  const min = config.messageMinWords;
  const max = config.messageMaxWords;
  if (count < min) return { result: 'fail', wordCount: count, reason: `Too short (${count} words, min ${min})` };
  if (count > max) return { result: 'fail', wordCount: count, reason: `Too long (${count} words, max ${max})` };
  return { result: 'pass', wordCount: count, reason: null };
}

function checkCitation(text, classification) {
  if (classification !== 'repository') return 'skip';
  const hasCitation = /source[s]?:\s*\S+/i.test(text) || /^[-*]\s+\S+\.\S+/m.test(text);
  return hasCitation ? 'pass' : 'fail';
}

function checkHallucination(text) {
  const violations = [];
  for (const { pattern, label } of HALLUCINATION_PATTERNS) {
    if (pattern.test(text)) violations.push(label);
  }
  if (violations.length > 0) {
    log.warn(`[AI/ResponseValidator] Hallucination indicators: ${violations.join(', ')}`);
    return { result: 'warn', reasons: violations };
  }
  return { result: 'skip', reasons: [] };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ValidationResult
 * @property {boolean} passed
 * @property {{ scope: string, prohibitedContent: string, secretPattern: string, wordCount: string, citation: string, hallucination: string }} checks
 * @property {number|null} wordCount
 * @property {string[]} failureReasons
 * @property {'pass'|'regenerate'|'hard-reject'} action
 * @property {string|null} regenerateInstruction  — prompt suffix for re-generation if action === 'regenerate'
 */

/**
 * Validate an AI-generated response.
 *
 * @param {string} responseText
 * @param {'repository'|'umamusume'|'live'|'message'|null} classification
 * @param {{ attempt?: number }} [options]   — attempt number for word-count regeneration logic
 * @returns {ValidationResult}
 */
export function validate(responseText, classification, options = {}) {
  if (typeof responseText !== 'string' || responseText.trim().length === 0) {
    return {
      passed: false,
      checks: { scope: 'skip', prohibitedContent: 'skip', secretPattern: 'fail', wordCount: 'skip', citation: 'skip', hallucination: 'skip' },
      wordCount: null,
      failureReasons: ['Response is empty or not a string'],
      action: 'hard-reject',
      regenerateInstruction: null,
    };
  }

  // Run all checks (conceptually parallel — synchronous here since they're all pure)
  const scopeResult      = checkScope(responseText, classification);
  const prohibitedResult = checkProhibited(responseText);
  const secretResult     = checkSecrets(responseText);
  const wordCountResult  = checkWordCount(responseText, classification);
  const citationResult   = checkCitation(responseText, classification);
  const hallucinResult   = checkHallucination(responseText);

  const failureReasons = [];
  let action = 'pass';
  let regenerateInstruction = null;

  // Secret pattern — always hard-reject (highest severity)
  if (secretResult.result === 'fail') {
    failureReasons.push(secretResult.reason);
    action = 'hard-reject';
  }

  // Prohibited content — hard-reject
  if (prohibitedResult.result === 'fail') {
    failureReasons.push(prohibitedResult.reason);
    if (action !== 'hard-reject') action = 'hard-reject';
  }

  // Scope — regenerate
  if (scopeResult === 'fail' && action === 'pass') {
    failureReasons.push('Response is out of scope for classification: ' + classification);
    action = 'regenerate';
    regenerateInstruction = `Please ensure your response is specifically about ${
      classification === 'repository' ? 'the Umakraft repository and codebase' :
      classification === 'umamusume'  ? 'Uma Musume game mechanics or terminology' :
      'community messages without system-internal content'
    }.`;
  }

  // Word count — regenerate (up to 2 attempts, then hard-reject)
  if (wordCountResult.result === 'fail' && action === 'pass') {
    failureReasons.push(wordCountResult.reason);
    if ((options.attempt ?? 1) < 2) {
      action = 'regenerate';
      const wc = wordCountResult.wordCount ?? 0;
      regenerateInstruction = wc < config.messageMinWords
        ? `Please expand your response to at least ${config.messageMinWords} words.`
        : `Please condense your response to at most ${config.messageMaxWords} words.`;
    } else {
      action = 'hard-reject'; // fallback triggered by caller
    }
  }

  // Citation — regenerate (max 1)
  if (citationResult === 'fail' && action === 'pass') {
    failureReasons.push('No source citation found in repository response');
    action = 'regenerate';
    regenerateInstruction = 'Please include the source file path for each fact you state (e.g. "Source: umamoe/Vault/vault.js").';
  }

  // Hallucination — warn only (does not block on its own)
  if (hallucinResult.result === 'warn' && action === 'pass') {
    failureReasons.push(...hallucinResult.reasons.map(r => `Hallucination indicator: ${r}`));
    action = 'regenerate';
    regenerateInstruction = 'Please only state facts that are present in the provided context. Avoid referencing external URLs or unverifiable version claims.';
  }

  const wc = wordCountResult.wordCount ?? (classification === 'message' ? countWords(responseText) : null);

  const result = {
    passed:   action === 'pass',
    checks: {
      scope:            scopeResult === 'pass' || scopeResult === 'skip' ? scopeResult : 'fail',
      prohibitedContent: prohibitedResult.result,
      secretPattern:    secretResult.result,
      wordCount:        wordCountResult.result,
      citation:         typeof citationResult === 'string' ? citationResult : citationResult,
      hallucination:    hallucinResult.result === 'warn' ? 'warn' : hallucinResult.result === 'skip' ? 'skip' : 'pass',
    },
    wordCount: wc,
    failureReasons,
    action,
    regenerateInstruction: action === 'regenerate' ? regenerateInstruction : null,
  };

  log.info(
    `[AI/ResponseValidator] ${result.passed ? 'PASS' : 'FAIL'} — ` +
    `action=${result.action} classification=${classification ?? 'none'} ` +
    `wordCount=${wc ?? 'n/a'}`
  );

  return result;
}

/**
 * The hard-reject message shown to Discord users.
 * Never reveals the internal reason.
 * @returns {string}
 */
export function hardRejectMessage() {
  return (
    "I wasn't able to generate a response that met the required quality standards. " +
    'Please try rephrasing your question, or contact a circle leader for assistance.'
  );
}
