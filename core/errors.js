// core/errors.js
// Shared error utilities used by the task scheduler and pipeline stages.
//
// safeRun()  — executes a function and swallows errors (records them instead of throwing)
// withRetry() — retries a function with linear backoff before propagating the error
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      Operation/Manager/Manager.md (Recovery Integration)

import log from './log.js';

/**
 * Run `fn` and swallow any thrown error, logging it instead.
 * Returns a result envelope so the caller can inspect success/failure
 * without a try/catch.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {string} context  — label used in log output
 * @returns {Promise<{ success: boolean, result: T|null, error: string|null }>}
 */
export async function safeRun(fn, context = 'unknown') {
  try {
    const result = await fn();
    return { success: true, result, error: null };
  } catch (err) {
    log.error(`[core/errors] safeRun caught error in "${context}": ${err.message}`);
    return { success: false, result: null, error: err.message };
  }
}

/**
 * Run `fn` with linear-backoff retries.
 * After `maxAttempts` consecutive failures the final error propagates to the caller.
 *
 * consecutiveFailures tracked via recordTaskEnd() will reach the Failed threshold
 * (> WITHRETRY_MAX = 3) after withRetry exhaustion.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ maxAttempts?: number, delayMs?: number, context?: string }} opts
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { maxAttempts = 3, delayMs = 1000, context = 'unknown' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Non-retriable errors (e.g. billing quota exhausted) should not be
      // retried — the outcome will be identical every time.
      if (err.isQuotaExhausted || err.isNonRetriable) throw err;
      log.warn(
        `[core/errors] withRetry attempt ${attempt}/${maxAttempts} failed` +
        ` for "${context}": ${err.message}`
      );
      if (attempt < maxAttempts) {
        await new Promise(resolve => { setTimeout(resolve, delayMs * attempt); });
      }
    }
  }
  throw lastError;
}
