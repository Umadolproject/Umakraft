// AI/Security.js
// Read-only enforcement wrapper for the AI Knowledge Service.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/SECURITY.md
//
// Responsibilities:
//   - Prepend the system constraint block to every prompt (cannot be removed)
//   - Sanitise user input before prompt injection
//   - Detect prohibited patterns in generated responses
//   - Provide the audit log schema used by the API Provider

import log from '../core/log.js';

// ---------------------------------------------------------------------------
// System Constraint Block
// ---------------------------------------------------------------------------
// This block is prepended to EVERY prompt sent to any AI provider.
// It cannot be removed, overridden, or injected over by user input.

const SYSTEM_CONSTRAINT_BLOCK = `You are the Umakraft AI Knowledge Service.
You are a read-only assistant. You may read and explain repository content
and Umamusume knowledge. You may never modify files, execute code, access
secrets, write to databases, or perform Discord administration.
If asked to perform any forbidden action, politely decline and explain
your read-only role.`;

// ---------------------------------------------------------------------------
// Prohibited response patterns (per AI/SECURITY.md)
// ---------------------------------------------------------------------------

const PROHIBITED_PATTERNS = [
  // Secret key prefixes
  { pattern: /sk-[A-Za-z0-9]{20,}/,          label: 'OpenAI API key pattern' },
  { pattern: /AIza[A-Za-z0-9_-]{35}/,         label: 'Google API key pattern' },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/, label: 'Bearer token pattern' },
  // Base64-encoded payloads (long base64 strings ≥ 64 chars)
  { pattern: /[A-Za-z0-9+/]{64,}={0,2}/,      label: 'Base64-encoded payload' },
  // Shell command instructions
  { pattern: /```\s*(bash|sh|zsh|shell|cmd|powershell)/i, label: 'Shell command block' },
  { pattern: /\brm\s+-rf\b/,                  label: 'Destructive shell command' },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a safe prompt by prepending the system constraint block and
 * injecting sanitised user content only through the {{question}} slot.
 *
 * @param {string} template   — prompt template with a {{question}} placeholder
 * @param {string} userInput  — raw user-supplied question
 * @param {Record<string, string>} [variables] — additional template variables
 * @returns {string} fully assembled prompt
 */
export function buildSafePrompt(template, userInput, variables = {}) {
  const sanitised = sanitiseInput(userInput);

  // Replace {{question}} first, then any other declared variables
  let body = template.replace(/\{\{question\}\}/g, sanitised);
  for (const [key, value] of Object.entries(variables)) {
    if (key === 'question') continue; // already handled
    body = body.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), sanitiseInput(String(value)));
  }

  // System block is always first — structurally separated from user content
  return `${SYSTEM_CONSTRAINT_BLOCK}\n\n---\n\n${body}`;
}

/**
 * Sanitise user-supplied input before injecting it into a prompt.
 * Strips characters that could be used for prompt injection.
 *
 * @param {string} input
 * @returns {string}
 */
export function sanitiseInput(input) {
  if (typeof input !== 'string') return '';

  return input
    .trim()
    // Remove null bytes and other control characters (except newline/tab)
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Collapse excessive whitespace lines (keep structure but prevent padding attacks)
    .replace(/\n{4,}/g, '\n\n\n')
    .slice(0, 2000); // hard cap — prevents oversized injection attempts
}

/**
 * Inspect an AI-generated response for prohibited patterns.
 * Returns a result object so the caller (Response Validator) can decide
 * whether to reject and what to log.
 *
 * @param {string} responseText
 * @returns {{ safe: boolean, violations: string[] }}
 */
export function inspectResponse(responseText) {
  if (typeof responseText !== 'string') {
    return { safe: false, violations: ['Response is not a string'] };
  }

  const violations = [];

  for (const { pattern, label } of PROHIBITED_PATTERNS) {
    if (pattern.test(responseText)) {
      violations.push(label);
    }
  }

  if (violations.length > 0) {
    log.error(
      `[AI/Security] Response rejected — prohibited patterns detected: ${violations.join(', ')}`
    );
  }

  return { safe: violations.length === 0, violations };
}

/**
 * Safe fallback message returned whenever a response is rejected.
 * Never reveals the reason to the Discord user.
 *
 * @returns {string}
 */
export function safeRejectionMessage() {
  return (
    'I was unable to generate a safe response to that request. ' +
    'Please try rephrasing your question or ask about a different topic.'
  );
}

/**
 * Build an audit log entry for a single AI request lifecycle.
 * Written via core/log.js — never to a file the Repository Indexer can read.
 *
 * @param {object} fields
 * @param {string}       fields.userId
 * @param {string}       fields.command
 * @param {string}       fields.query
 * @param {string}       fields.topicClassification
 * @param {boolean}      fields.providerCalled
 * @param {string|null}  fields.provider
 * @param {string|null}  fields.model
 * @param {number|null}  fields.responseTokens
 * @param {boolean}      fields.cacheHit
 * @param {number}       fields.durationMs
 */
export function auditLog(fields) {
  const entry = {
    timestamp:          new Date().toISOString(),
    userId:             fields.userId           ?? 'unknown',
    command:            fields.command          ?? 'unknown',
    query:              fields.query            ?? '',
    topicClassification: fields.topicClassification ?? 'unknown',
    providerCalled:     fields.providerCalled   ?? false,
    provider:           fields.provider         ?? null,
    model:              fields.model            ?? null,
    responseTokens:     fields.responseTokens   ?? null,
    cacheHit:           fields.cacheHit         ?? false,
    durationMs:         fields.durationMs       ?? 0,
  };

  // API keys must never appear in audit logs — enforce at the log boundary
  const safeEntry = JSON.stringify(entry);
  if (/sk-|AIza|Bearer /i.test(safeEntry)) {
    log.error('[AI/Security] Audit log entry contained a secret pattern — entry suppressed.');
    return;
  }

  log.info(`[AI/Audit] ${safeEntry}`);
}

/**
 * Expose the system constraint block for testing purposes only.
 * Production code must always use buildSafePrompt().
 */
export { SYSTEM_CONSTRAINT_BLOCK };
