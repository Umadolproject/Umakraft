# Telemetry

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Describe logging, metrics, and observability approaches used across the UmaKraft pipeline to make every stage inspectable without adding noise.

---

## Must Not

Telemetry must **never**:

* Log sensitive keys — mask `UMA_MOE_API_KEY`, Discord bot tokens, and OAuth credentials
* Log full personal identifiers in high-frequency traces — use IDs and counts, not full profiles
* Be the only signal for a failure — structured logs supplement error envelopes, they do not replace them
* Add blocking overhead to the hot path — all telemetry must be async or fire-and-forget

---

## Structured Log Format

All components emit structured logs using `core/log.js`:

```js
// core/log.js — structured wrapper around console
import log from './log.js';

log.info('[Miner] Acquisition ok', { endpoint, statusCode: 200, duration: 145 });
log.warn('[Inspector] Validation failed', { trainerId, reason: 'INVALID_TYPE' });
log.error('[Depot] Persistence failure', { id, error: err.message, retriable: true });
log.debug('[Courier] Transport envelope', { envelopeSize: raw.length });
```

Log entry format:
```json
{
  "timestamp": "2026-07-21T10:00:00.000Z",
  "level": "info",
  "component": "Miner",
  "message": "Acquisition ok",
  "context": {
    "endpoint": "/api/v4/user/profile/612856830731",
    "statusCode": 200,
    "duration": 145
  }
}
```

---

## What to Capture Per Stage

| Stage | Key signals |
|---|---|
| **Miner** | endpoint, statusCode, attempts, duration |
| **Courier** | transport duration, endpoint, result (ok/fail) |
| **Inspector** | pass/fail reason, trainerId, validationTime |
| **Vault** | store/get/update/delete results, latency |
| **Refiner** | processed count, derived fields, refinerVersion |
| **Compiler** | template used, conflict resolutions, compileTime |
| **Depot** | put/get latency, storage quota signals |
| **Workshop** | blueprint, fabricationTime, validationResult |
| **Broadcast** | notificationKey, step (channel/dm), outcome, discordCode |
| **Operation** | decision, affectedSubjects, cycleTime |

---

## Environment Toggles

```js
// Verbose Miner logs (development only)
if (process.env.UMA_MOE_VERBOSE === 'true') {
  log.debug('[Miner] raw response', { data });
}

// Reduce noise in production
if (process.env.NODE_ENV !== 'production') {
  log.debug('[Inspector] Full envelope', { envelope });
}
```

Key env vars:
- `UMA_MOE_VERBOSE` — enables detailed Miner request/response logs
- `DEBUG_MINER` — logs raw HTTP responses from uma.moe
- `NODE_ENV` — set to `production` to suppress debug-level logs

---

## Metrics (Optional Integration)

For production observability, emit counters and histograms:

```js
// telemetry/metrics.js

export function increment(name, tags = {}) {
  // emit to Prometheus/statsd/DataDog
  // fire-and-forget — never block the calling function
  statsClient?.increment(name, tags).catch(() => {});
}

export function histogram(name, value, tags = {}) {
  statsClient?.timing(name, value, tags).catch(() => {});
}

// Usage
increment('miner.acquisition.success', { endpoint: '/api/v4/user/profile' });
histogram('miner.acquisition.duration_ms', 145, { endpoint: '/api/v4/user/profile' });
```

Recommended metric names:
- `miner.acquisition.success` / `.failure` (counter)
- `miner.acquisition.duration_ms` (histogram)
- `inspector.validation.pass` / `.fail` (counter)
- `depot.put.success` / `.failure` (counter)
- `broadcast.delivery.channel` / `.dm_member` / `.dm_leader` (counter, by outcome)

---

## Privacy

* Mask `UMA_MOE_API_KEY` in all output
* Do not log Discord user IDs or full trainer profiles at `INFO` level in production
* Apply log sampling for high-frequency debug traces (e.g. every 10th Miner request)

---

## See Also

- `core/log.js` — structured log wrapper
- `Operation/Logger/Logger.md` — operational log format
- `Operation/Investigator/Investigator.md` — what Operation reads from task/runtime state
