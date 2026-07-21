# Validator

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 3 — Workshop (Generate Presentation Artifacts)
**Last Updated:** 2026-07-21

---

## Purpose

The **Validator** department is the Workshop quality-control gate.

It receives every unvalidated deliverable emitted by the Fabricator and confirms that it satisfies the Draftsman specification before it is allowed to enter the Terminal.

A deliverable is only considered complete when the Validator has approved it. No deliverable may enter the Terminal without passing validation. The Fabricator cannot approve its own output.

---

## Responsibilities

- Receive unvalidated deliverables from the Fabricator.
- Confirm the deliverable envelope is structurally sound and complete.
- Confirm the `blueprintKey` is registered in the Draftsman blueprint registry.
- Confirm the PNG output buffer is non-empty and meets minimum size thresholds.
- Confirm deliverable metadata is consistent with its blueprint specification.
- Approve valid deliverables and emit them to the Terminal.
- Reject invalid deliverables and return a structured issue report.
- Log all validation outcomes for traceability.

## Must Not

The Validator must **never**:

- Retrieve external data or call external APIs.
- Perform business calculations or create derived content.
- Compile raw information or produce data products.
- Design or modify Draftsman specifications.
- Manufacture or re-render deliverables.
- Distribute approved deliverables.
- Modify a deliverable's content when approving it.
- Approve a deliverable based on Fabricator intent rather than specification compliance.
- Re-implement data validation that belongs to the Inspector (Stage 1, Umamoe).

Those responsibilities belong to other departments.

---

## Position in Pipeline

```text
Depot (Refinery)
        │
        ▼
  Draftsman  ──► Blueprint Registry
        │
        ▼
  Fabricator
        │
        ▼  (unvalidated deliverable)
  Validator  ◄── Blueprint Registry (cross-reference)
        │
        ├── Approved ──► Terminal
        │
        └── Rejected ──► Fabricator
```

---

## Input

The Validator receives one of two envelope shapes from the Fabricator.

### Success Envelope (Deliverable to Validate)

```javascript
{
  success:           true,
  blueprintKey:      string,   // e.g. "fanGain", "profile", "leaderboard"
  blueprintName:     string,   // e.g. "Fan Gain"
  trigger:           string,   // e.g. "/fan_gain"
  type:              string,   // "command" | "broadcast"
  png:               Buffer,   // rendered PNG image
  meta:              object,   // compiled product metadata
  fabricatorVersion: string,   // e.g. "3.0.0"
  renderedAt:        string,   // ISO 8601 timestamp
}
```

### Failure Envelope (Fabricator Error — Pass Through)

```javascript
{
  success:   false,
  error:     string,   // e.g. "FABRICATOR_RENDER_ERROR"
  message:   string,
  timestamp: string,
  context:   object,
}
```

Fabricator failure envelopes are passed through to the Terminal unchanged. The Validator does not validate failed fabrications — it records the passthrough and forwards the envelope.

---

## Validation Categories

The Validator applies **five sequential categories**. A deliverable must pass all five to be approved.

### Category 1 — Existence

Confirm the deliverable envelope is not null or empty.

| Rule | Check | Failure Reason |
|------|-------|----------------|
| Envelope is not null or undefined | `envelope != null` | `EXISTENCE_FAILURE: Deliverable is null or undefined` |
| Envelope is a plain object | `typeof envelope === 'object' && !Array.isArray(envelope)` | `EXISTENCE_FAILURE: Deliverable is not an object` |
| Envelope declares success | `envelope.success === true` | `EXISTENCE_FAILURE: Deliverable success flag is not true` |

### Category 2 — Structure

Confirm all required envelope fields are present and non-null.

| Field | Required Type | Failure Reason |
|-------|--------------|----------------|
| `blueprintKey` | `string` | `STRUCTURE_FAILURE: Missing or invalid blueprintKey` |
| `blueprintName` | `string` | `STRUCTURE_FAILURE: Missing or invalid blueprintName` |
| `trigger` | `string` | `STRUCTURE_FAILURE: Missing or invalid trigger` |
| `type` | `"command" \| "broadcast"` | `STRUCTURE_FAILURE: type must be "command" or "broadcast"` |
| `png` | `Buffer` | `STRUCTURE_FAILURE: Missing png field` |
| `renderedAt` | `string` | `STRUCTURE_FAILURE: Missing or invalid renderedAt` |

### Category 3 — Blueprint Registration

Confirm the `blueprintKey` is registered in the Draftsman blueprint registry (`Workshop/Draftsman/Blueprint/blueprint.js`).

| Rule | Check | Failure Reason |
|------|-------|----------------|
| Key exists in registry | `blueprints[blueprintKey] !== undefined` | `BLUEPRINT_FAILURE: blueprintKey "<key>" is not registered` |
| Blueprint name matches registry | `descriptor.name === envelope.blueprintName` | `BLUEPRINT_FAILURE: blueprintName mismatch` |
| Trigger matches registry | `descriptor.trigger === envelope.trigger` | `BLUEPRINT_FAILURE: trigger mismatch for blueprintKey "<key>"` |
| Type matches registry | `descriptor.type === envelope.type` | `BLUEPRINT_FAILURE: type mismatch for blueprintKey "<key>"` |

### Category 4 — Output Integrity

Confirm the PNG buffer is non-empty and meets minimum size thresholds.

| Rule | Check | Failure Reason |
|------|-------|----------------|
| PNG is a Buffer | `Buffer.isBuffer(png)` | `OUTPUT_FAILURE: png is not a Buffer` |
| PNG is not empty | `png.length > 0` | `OUTPUT_FAILURE: png buffer is empty` |
| PNG meets minimum size | `png.length >= 1024` | `OUTPUT_FAILURE: png buffer is suspiciously small (${n} bytes)` |
| PNG header is valid | First 8 bytes match PNG signature | `OUTPUT_FAILURE: png buffer does not have a valid PNG header` |

> **PNG Signature:** `\x89PNG\r\n\x1a\n` — bytes `[137, 80, 78, 71, 13, 10, 26, 10]`

### Category 5 — Metadata Consistency

Confirm deliverable metadata is internally consistent and contains minimum required fields.

| Rule | Check | Failure Reason |
|------|-------|----------------|
| `meta` is a plain object | `typeof meta === 'object' && !Array.isArray(meta)` | `METADATA_FAILURE: meta is not an object` |
| `renderedAt` is a valid ISO 8601 string | `!isNaN(Date.parse(renderedAt))` | `METADATA_FAILURE: renderedAt is not a valid ISO 8601 date` |
| `fabricatorVersion` is present | `typeof fabricatorVersion === 'string'` | `METADATA_FAILURE: Missing or invalid fabricatorVersion` |

---

## Validation Decision Tree

```text
Receive Envelope from Fabricator
              │
              ▼
    success === false?
              │
     YES      │  NO
      │        │
      ▼        ▼
  Pass Through    Category 1: Existence
  to Terminal     Envelope exists and is an object?
                        │
                   NO ──┤  YES
                        │    │
                   REJECT    ▼
                        Category 2: Structure
                        All required fields present and typed?
                              │
                         NO ──┤  YES
                              │    │
                         REJECT    ▼
                              Category 3: Blueprint Registration
                              blueprintKey registered? Fields match registry?
                                    │
                               NO ──┤  YES
                                    │    │
                               REJECT    ▼
                                    Category 4: Output Integrity
                                    PNG is valid Buffer, non-empty, valid header?
                                          │
                                     NO ──┤  YES
                                          │    │
                                     REJECT    ▼
                                          Category 5: Metadata Consistency
                                          meta, renderedAt, fabricatorVersion valid?
                                                │
                                           NO ──┤  YES
                                                │    │
                                           REJECT    ▼
                                               APPROVE → Terminal
```

---

## Output

### Approved Envelope

Emitted to the Terminal when all five categories pass.

```javascript
{
  success:         true,
  approved:        true,
  blueprintKey:    string,
  blueprintName:   string,
  trigger:         string,
  type:            string,
  png:             Buffer,
  meta:            object,
  validatedAt:     string,   // ISO 8601 — set by Validator
  fabricatorVersion: string,
}
```

### Rejected Envelope

Returned to the Fabricator (or logged for correction) when any category fails.

```javascript
{
  success:         false,
  approved:        false,
  error:           string,   // e.g. "BLUEPRINT_FAILURE"
  message:         string,   // e.g. "BLUEPRINT_FAILURE: blueprintKey "unknown" is not registered"
  category:        string,   // which of the 5 categories failed
  retriable:       boolean,  // false for structural failures; implementation may extend this
  timestamp:       string,
  context: {
    blueprintKey:  string,
    originalData:  object,   // the unvalidated deliverable (preserved for diagnostics)
  }
}
```

### Passthrough Envelope

Emitted unchanged to the Terminal when the Fabricator itself reported a failure.

```javascript
{
  success:   false,
  error:     string,
  message:   string,
  timestamp: string,
  context:   object,
}
```

---

## Rejection Message Format

All rejection messages follow the format:

```
{CATEGORY}_FAILURE: {specific reason}
```

**Examples:**

- `EXISTENCE_FAILURE: Deliverable is null or undefined`
- `STRUCTURE_FAILURE: Missing or invalid blueprintKey`
- `BLUEPRINT_FAILURE: blueprintKey "unknown" is not registered`
- `OUTPUT_FAILURE: png buffer does not have a valid PNG header`
- `METADATA_FAILURE: renderedAt is not a valid ISO 8601 date`

---

## Interface

```javascript
// Workshop/Validator/Validator.js

/**
 * Validate a Fabricator deliverable.
 *
 * Failure envelopes (success: false) are passed through unchanged.
 * Success envelopes run all 5 validation categories.
 *
 * @param {object} deliverable — from Fabricator
 * @returns {ValidatorResult}
 */
export function validate(deliverable);

/**
 * Format an approved deliverable for the Terminal.
 *
 * @param {object} deliverable — validated deliverable
 * @returns {ApprovedEnvelope}
 */
export function approve(deliverable);

/**
 * Format a rejected deliverable for return.
 *
 * @param {string} category   — which validation category failed
 * @param {string} reason     — human-readable explanation
 * @param {object} deliverable — original deliverable (preserved for diagnostics)
 * @returns {RejectedEnvelope}
 */
export function reject(category, reason, deliverable);

/**
 * Produce a validation summary.
 *
 * @param {object} deliverable — the deliverable that was evaluated
 * @returns {ValidationReport}
 */
export function report(deliverable);
```

---

## Logging

The Validator emits structured JSON logs for every outcome.

| Event | Level | Example |
|-------|-------|---------|
| Deliverable approved | `info` | `validator: approved — blueprintKey=fanGain` |
| Deliverable rejected | `warn` | `validator: rejected — BLUEPRINT_FAILURE: blueprintKey "x" is not registered` |
| Fabricator failure passed through | `info` | `validator: passing through fabricator failure — FABRICATOR_RENDER_ERROR` |
| Unexpected internal error | `error` | `validator: unexpected error — <message>` |

---

## Implementation Structure

```text
Workshop/Validator/
├── Validator.js              — public API: validate(), approve(), reject(), report()
├── Validator.md              — this document
└── validation/
    ├── existence.js          — Category 1
    ├── structure.js          — Category 2
    ├── blueprintRegistration.js  — Category 3
    ├── outputIntegrity.js    — Category 4
    └── metadataConsistency.js    — Category 5
```

Each validation module exports a single function:

```javascript
// @param {object} deliverable
// @returns {{ ok: boolean, reason?: string }}
export function validate*(deliverable);
```

---

## Design Principle

The Validator is independent from the Fabricator.

The Fabricator manufactures the deliverable. The Validator decides whether that deliverable meets the specification. These are separate concerns and must never be merged.

The Validator does not fix deliverables. It approves or rejects them. Correction is the Fabricator's responsibility.

A deliverable is only production-ready after the Validator has approved it and it has been accepted into the Terminal.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority — supreme law |
| `GOVERNANCE/PIPELINE_REGISTRY.md` | Official department registry and ownership rules |
| `Workshop/Workshop.md` | Workshop pipeline overview |
| `Workshop/Fabricator/Fabricator.md` | Upstream department — produces deliverables |
| `Workshop/Draftsman/Blueprint/blueprint.js` | Blueprint registry — source of truth for Category 3 |
| `Workshop/Terminal/Terminal.md` | Downstream department — receives approved deliverables |

---

## Version History

**v1.0** (2026-07-21) — Initial specification  
**v2.0** (2026-07-21) — Added responsibilities, Must Not, interface, workflow  
**v3.0** (2026-07-21) — Full alignment with pipeline and governance standards  
- Added exact Fabricator deliverable envelope shapes (success and failure)  
- Added five Workshop-specific validation categories with rule tables  
- Added validation decision tree  
- Added approved, rejected, and passthrough output envelope shapes  
- Added rejection message format specification  
- Added logging requirements  
- Added recommended implementation file structure  
- Added related documents cross-reference table  
- Aligned header format and governance references with Fabricator v3.0.0 style
