# Errors

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Centralize error classifications used across the UmaKraft pipeline and provide guidance for handling, logging, and surfacing errors consistently.

---

## Must Not

Error handling must **never**:

* Swallow errors silently — every error must be logged with context
* Retry non-retriable errors
* Expose raw stack traces or internal paths to Discord output
* Use `console.error` without a structured context object in production

---

## Classification

| Prefix | Meaning | Retriable |
|---|---|---|
| `NETWORK_*` | Transient network issues (timeout, connection refused, DNS) | ✅ Yes |
| `API_*` (4xx) | API-specific client errors (bad request, unauthorized, not found) | ❌ No |
| `API_*` (5xx) | API server errors | ✅ Yes |
| `MINER_*` | Miner-level errors (invalid input, unapproved endpoint) | ❌ No |
| `TRANSPORT_*` | Courier/delivery errors | Depends |
| `VAULT_*` | Vault storage errors | Depends |
| `COMPILER_*` | Compiler assembly errors | Depends |
| `DEPOT_*` | Depot persistence errors | ✅ Yes |
| `BROADCAST_*` | Broadcast pipeline errors | Depends |

---

## Standard Error Envelope

```js
{
  success: false,
  error: 'ERROR_CODE',             // SCREAMING_SNAKE_CASE
  message: 'Human-readable text',  // for logs and alerts
  severity: 'info' | 'warning' | 'critical',
  retriable: true | false,
  timestamp: '2026-07-21T10:00:00.000Z',
  context: {
    // department-specific fields
  }
}
```

---

## Usage Pattern

```js
// core/errors.js

/**
 * Wraps an async function with error catching.
 * Returns a structured error envelope instead of throwing.
 */
export async function safeRun(fn, context = {}) {
  try {
    return await fn();
  } catch (err) {
    log.error(`[safeRun] ${err.message}`, context);
    return {
      success: false,
      error: 'INTERNAL_ERROR',
      message: err.message,
      severity: 'critical',
      retriable: false,
      timestamp: new Date().toISOString(),
      context: { ...context, stack: err.stack }
    };
  }
}

/**
 * Wraps an async function with linear backoff retries.
 * Stops and returns the error on non-retriable failures.
 */
export async function withRetry(fn, opts = {}) {
  const { maxAttempts = 3, delayMs = 1000 } = opts;
  let lastError;
  for (let i = 0; i < maxAttempts; i++) {
    const result = await fn();
    if (result.success) return result;
    if (!result.retriable) return result;
    lastError = result;
    if (i < maxAttempts - 1) await sleep(delayMs * (i + 1));
  }
  return { ...lastError, message: `[withRetry] All ${maxAttempts} attempts failed: ${lastError?.message}` };
}
```

---

## Guidance

- Include `error.message` and `error.context` in all log entries
- Mark `retriable: true` for transient errors to enable caller backoff
- Use `severity: 'critical'` for errors that should page (storage down, auth failures)
- Use `severity: 'warning'` for errors that are logged but handled automatically
- Use `severity: 'info'` for expected non-events (e.g. 404 on an optional resource)

---

## See Also

- `umamoe/ERROR_HANDLING.md` — full error specification with per-department examples
- `core/errors.js` — `safeRun()` and `withRetry()` implementations
- `Operation/Manager/Manager.md` — how errors feed into health decisions
