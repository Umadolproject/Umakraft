# Delivery

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Describe the transport layer (Courier) responsible for delivering Miner envelopes to the Inspector. Courier is the boundary between raw acquisition and validation — it moves data without altering it.

---

## Must Not

Delivery / Courier must **never**:

* Modify, filter, or reinterpret the Miner envelope
* Re-attempt inspection after a transport failure — let the caller decide retry policy
* Inspect or validate data content — that belongs to the Inspector
* Store data permanently
* Call Broadcast, Discord, or any external API

---

## Responsibilities

* Validate Miner envelope shape before delivery (presence of `success` field, non-null data)
* Pass-through Miner failure envelopes unchanged
* Measure delivery time and log transport events
* Return Inspector result or a structured transport-error envelope

---

## Failure Handling

* On transient transport failures, return a retriable error envelope (`retriable: true`)
* Do not re-attempt inspection inside Courier — let the caller decide retry policy
* Preserve original input in transport error context for diagnostics

---

## Interface

```js
// courier.js

/**
 * Validates the Miner envelope is transportable, then delivers it to Inspector.
 * Returns Inspector result or a transport-error envelope.
 *
 * @param {MinerEnvelope} envelope
 * @returns {{ success: boolean, result?: InspectorResult, error?: string }}
 */
async function transport(envelope) {
  const transportable = validateTransportability(envelope);
  if (!transportable.ok) {
    return {
      success: false,
      error: 'TRANSPORT_INVALID_INPUT',
      message: transportable.reason,
      retriable: false,
      timestamp: new Date().toISOString(),
      context: { envelope }
    };
  }

  // Pass-through Miner failures unchanged
  if (envelope.success === false) {
    return { success: false, passthrough: true, original: envelope };
  }

  try {
    const start = Date.now();
    const result = await inspector.receive(envelope.data);
    log.info(`[Courier] transport ok — duration=${Date.now() - start}ms`);
    return { success: true, result };
  } catch (err) {
    log.error(`[Courier] delivery failed — ${err.message}`);
    return {
      success: false,
      error: 'TRANSPORT_DELIVERY_FAILED',
      message: 'Courier failed to deliver envelope to Inspector',
      retriable: true,
      timestamp: new Date().toISOString(),
      context: { originalError: err.message }
    };
  }
}

/**
 * Checks that the envelope has the minimum required shape for transport.
 */
function validateTransportability(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return { ok: false, reason: 'Envelope is null or not an object' };
  }
  if (!('success' in envelope)) {
    return { ok: false, reason: 'Envelope missing required "success" field' };
  }
  return { ok: true };
}
```

---

## See Also

- `umamoe/Courier/Courier.md` — full Courier specification
- `umamoe/Inspector/Inspector.md` — Inspector contract
- `Distribution/dist/Contracts/contract.md` — Miner envelope schema
