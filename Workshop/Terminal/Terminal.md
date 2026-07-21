# Terminal

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 3 — Workshop (Generate Presentation Artifacts)
**Last Updated:** 2026-07-21

---

## Purpose

The **Terminal** is the Workshop's departure point.

It is an immutable staging area that receives approved deliverables from the Validator and holds them in a stable, ready state until the Distribution Coordinator retrieves them.

The Terminal does not manufacture, validate, modify, or deliver anything. Its sole responsibility is to preserve approved deliverables and provide a clean, reliable handoff surface for Distribution.

A deliverable enters the Terminal once — approved and unchanged. It leaves once — claimed by Distribution.

---

## Pipeline Position

```text
Validator
    │
    ▼  (approved deliverable)
Terminal
    │
    ▼  (Coordinator pickup)
Distribution / Coordinator
    │
    ▼
Distribution / Dispatcher
```

The Terminal is the boundary between the Workshop and Distribution.

Workshop stages (Draftsman, Fabricator, Validator) operate on the upstream side of this boundary.
Distribution stages (Coordinator, Dispatcher) operate on the downstream side.

No stage may bypass the Terminal to pass a deliverable directly between Workshop and Distribution.

---

## Responsibilities

- Accept approved deliverables from the Validator.
- Assign each deliverable a unique terminal ID.
- Store deliverables in an immutable, ready state.
- Track the lifecycle state of each deliverable (`pending` → `claimed`).
- Expose a pickup interface for the Distribution Coordinator.
- Return release metadata for Distribution processing.
- Reject any input that does not carry a valid Validator approval.
- Log all intake and pickup events.

## Must Not

The Terminal must **never**:

- Retrieve external data or call external APIs.
- Perform business calculations or content generation.
- Compile or transform data products.
- Create or modify Draftsman specifications.
- Manufacture or render deliverables.
- Validate or approve deliverables — that belongs to the Validator.
- Modify a deliverable after it has been stored.
- Deliver responses to Discord — that belongs to Distribution/Dispatcher.
- Accept a deliverable that was not approved by the Validator.

Those responsibilities belong to other departments.

---

## Input

The Terminal accepts only Validator-approved envelopes.

### Approved Deliverable Envelope (from Validator)

```javascript
{
  success:           true,
  approved:          true,
  blueprintKey:      string,   // e.g. "fanGain", "profile", "leaderboard"
  blueprintName:     string,   // e.g. "Fan Gain"
  trigger:           string,   // e.g. "/fan_gain"
  type:              string,   // "command" | "broadcast"
  png:               Buffer,   // rendered PNG image
  meta:              object,   // compiled product metadata (trainerId, trainerName, etc.)
  validatedAt:       string,   // ISO 8601 — set by Validator
  fabricatorVersion: string,   // e.g. "3.0.0"
}
```

The Terminal verifies the presence of `approved: true` before accepting. Any envelope without this flag is rejected immediately.

### Fabricator Failure Passthrough (from Validator)

```javascript
{
  success:   false,
  error:     string,
  message:   string,
  timestamp: string,
  context:   object,
}
```

Failure passthroughs are logged and forwarded to the Coordinator as-is. They are not stored in the Terminal's deliverable queue.

---

## Deliverable Lifecycle

Each deliverable progresses through two states inside the Terminal:

```text
[accepted]
Validator approves deliverable.
Terminal assigns a terminalId and stores it.
State: pending
        │
        ▼
[claimed]
Coordinator calls pickup(terminalId).
Terminal marks the deliverable as claimed and returns it.
State: claimed
        │
        ▼
[released]
Terminal removes the claimed deliverable from the active queue.
Deliverable is now fully owned by Distribution.
```

| State | Description |
|-------|-------------|
| `pending` | Approved and stored. Awaiting pickup by Distribution. |
| `claimed` | Retrieved by Distribution Coordinator. No longer in active queue. |

A deliverable in `pending` state is available to `listReady()` and `pickup()`.
A deliverable in `claimed` state is no longer returned by `listReady()`.

---

## Storage Model

The Terminal uses an adapter pattern identical to the Depot (Refinery Stage 2).

Underlying storage is provided by an adapter module. The `terminal.js` implementation never calls a storage engine directly — it always delegates to the active adapter. This allows the storage backend to be replaced without modifying the Terminal's public API.

### Stored Record Shape

```javascript
{
  terminalId:        string,   // unique ID assigned by Terminal — e.g. "terminal-fanGain-1721580000000"
  blueprintKey:      string,
  blueprintName:     string,
  trigger:           string,
  type:              string,
  png:               Buffer,   // immutable — never overwritten after storage
  meta:              object,
  validatedAt:       string,
  fabricatorVersion: string,
  receivedAt:        string,   // ISO 8601 — set by Terminal at intake
  state:             "pending" | "claimed",
  claimedAt:         string | null,  // ISO 8601 when claimed, null while pending
}
```

### Adapter Interface

```javascript
// Workshop/Terminal/adapters/memoryAdapter.js

export async function put(record);
// Stores a record. Returns { success: boolean }.

export async function get(terminalId);
// Retrieves a record by terminalId. Returns { record: object | null }.

export async function list(filter);
// Lists records matching filter. Returns { results: object[] }.

export async function del(terminalId);
// Deletes a record. Returns { success: boolean }.
```

---

## Interface

```javascript
// Workshop/Terminal/terminal.js

/**
 * Receive an approved deliverable from the Validator and store it.
 *
 * Rejects any envelope that is not approved (approved !== true).
 *
 * @param {object} approvedDeliverable — Validator-approved envelope
 * @returns {Promise<TerminalReceiveResult>}
 *
 * @example
 * const result = await receive(approvedDeliverable);
 * // result.success === true → result.terminalId is the assigned ID
 */
export async function receive(approvedDeliverable);

/**
 * Claim a pending deliverable for Distribution.
 *
 * Marks the record as claimed and returns the full deliverable.
 * Returns an error result if the terminalId is not found or already claimed.
 *
 * @param {string} terminalId
 * @returns {Promise<TerminalPickupResult>}
 *
 * @example
 * const result = await pickup(terminalId);
 * // result.success === true → result.deliverable is the full record
 */
export async function pickup(terminalId);

/**
 * List all pending deliverables available for Distribution pickup.
 *
 * @param {{ blueprintKey?: string, type?: string }} [filter]
 * @returns {Promise<{ results: TerminalRecord[] }>}
 */
export async function listReady(filter);

/**
 * Retrieve release metadata for a stored deliverable.
 *
 * Returns lightweight metadata without the PNG buffer.
 * Used by the Coordinator to confirm availability before calling pickup().
 *
 * @param {string} terminalId
 * @returns {Promise<TerminalMetadataResult>}
 */
export async function getReleaseMetadata(terminalId);
```

---

## Output

### Receive Result

Returned by `receive()` on successful intake.

```javascript
{
  success:     true,
  terminalId:  string,   // assigned by Terminal
  receivedAt:  string,   // ISO 8601
}
```

### Pickup Result

Returned by `pickup()` when the Coordinator claims a deliverable.

```javascript
{
  success:   true,
  terminalId: string,
  deliverable: {
    terminalId:        string,
    blueprintKey:      string,
    blueprintName:     string,
    trigger:           string,
    type:              string,
    png:               Buffer,
    meta:              object,
    validatedAt:       string,
    fabricatorVersion: string,
    receivedAt:        string,
    claimedAt:         string,
  }
}
```

### Release Metadata

Returned by `getReleaseMetadata()` — no PNG buffer included.

```javascript
{
  success:           true,
  terminalId:        string,
  blueprintKey:      string,
  blueprintName:     string,
  trigger:           string,
  type:              string,
  meta:              object,
  validatedAt:       string,
  receivedAt:        string,
  state:             "pending" | "claimed",
  claimedAt:         string | null,
}
```

### Error Result

Returned by any method on failure.

```javascript
{
  success:   false,
  error:     string,   // e.g. "TERMINAL_NOT_FOUND", "TERMINAL_ALREADY_CLAIMED"
  message:   string,
  timestamp: string,
  context:   object,
}
```

---

## Error Codes

| Code | Trigger |
|------|---------|
| `TERMINAL_INVALID_INPUT` | `receive()` called with a non-approved envelope |
| `TERMINAL_NOT_FOUND` | `pickup()` or `getReleaseMetadata()` called with unknown `terminalId` |
| `TERMINAL_ALREADY_CLAIMED` | `pickup()` called on a deliverable already in `claimed` state |
| `TERMINAL_STORE_FAILURE` | Adapter failed to persist the record |
| `TERMINAL_UNEXPECTED_ERROR` | Unhandled internal exception |

---

## Logging

The Terminal emits structured JSON logs for every significant event.

| Event | Level | Example Message |
|-------|-------|-----------------|
| Deliverable received | `info` | `terminal: stored — terminalId=terminal-fanGain-1721580000000 blueprintKey=fanGain` |
| Deliverable claimed | `info` | `terminal: claimed — terminalId=terminal-fanGain-1721580000000` |
| Invalid input rejected | `error` | `terminal: TERMINAL_INVALID_INPUT — envelope not approved` |
| Not found | `warn` | `terminal: TERMINAL_NOT_FOUND — terminalId=terminal-x` |
| Already claimed | `warn` | `terminal: TERMINAL_ALREADY_CLAIMED — terminalId=terminal-x claimedAt=<iso>` |
| Unexpected error | `error` | `terminal: TERMINAL_UNEXPECTED_ERROR — <message>` |

Log format matches the structured JSON pattern used across the pipeline:

```javascript
{
  timestamp: string,   // ISO 8601
  level:     string,   // "info" | "warn" | "error"
  component: "terminal",
  message:   string,
  ...context
}
```

---

## Implementation Structure

```text
Workshop/Terminal/
├── terminal.js              — public API: receive(), pickup(), listReady(), getReleaseMetadata()
├── Terminal.md              — this document
└── adapters/
    └── memoryAdapter.js     — in-memory store (mirrors Refinery/Depot/adapters/memoryAdapter.js)
```

The adapter pattern is consistent with `Refinery/Depot/depot.js`. Any future persistent adapter (file system, database) must implement the same four functions (`put`, `get`, `list`, `del`) so `terminal.js` needs no changes.

---

## Design Principle

The Terminal is a **stabilization and handoff layer**, not a processing stage.

It creates a clean, explicit boundary between Workshop and Distribution. Without the Terminal, the Coordinator would need to hold a live reference to a Fabricator render in memory — which couples two pipeline stages that have no business knowing about each other.

The Terminal breaks that coupling. The Workshop deposits. Distribution withdraws. Neither stage knows how the other operates.

> The Workshop creates and approves the deliverable.
> The Terminal holds it for departure.
> Distribution claims and delivers it.

Deliverables are immutable once stored. The Terminal never edits what it receives. If a deliverable is wrong, it must be rejected by the Validator before it reaches the Terminal — not corrected inside it.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority — supreme law |
| `GOVERNANCE/PIPELINE_REGISTRY.md` | Official department registry and ownership rules |
| `Workshop/Workshop.md` | Workshop pipeline overview |
| `Workshop/Validator/Validator.md` | Upstream department — produces approved envelopes |
| `Distribution/Coordinator/Coordinator.md` | Downstream consumer — calls pickup() |
| `Refinery/Depot/depot.js` | Reference implementation for adapter pattern |

---

## Version History

**v1.0** (2026-07-21) — Initial specification  
**v2.0** (2026-07-21) — Added responsibilities, Must Not, interface, workflow, design principle  
**v3.0** (2026-07-21) — Full alignment with pipeline, code, and governance standards  
- Added exact approved deliverable input envelope (from Validator v3.0.0)  
- Added deliverable lifecycle model (`pending` → `claimed` → released)  
- Added stored record shape with `terminalId`, `state`, `receivedAt`, `claimedAt`  
- Added adapter pattern specification mirroring Refinery/Depot  
- Added full interface with typed signatures and usage examples  
- Added receive, pickup, metadata, and error output envelope shapes  
- Added complete error code table  
- Added structured JSON logging specification  
- Added implementation file structure  
- Added pipeline position diagram showing Workshop/Distribution boundary  
- Aligned header format and governance references with Workshop v3.0.0 style
