# Retriever

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Describe the Retriever — the planned Distribution department responsible for pulling approved deliverables from `Workshop/Terminal` and routing them to Dispatcher for final Discord delivery.

The Retriever is the bridge between the Workshop's output and Distribution's delivery layer.

---

## Must Not

Retriever must **never**:

* Modify or re-render deliverables — Terminal content is immutable once approved
* Pull from Depot directly — it reads from Terminal, not from Refinery storage
* Send to Discord directly — that is Dispatcher's responsibility
* Fetch raw API data from uma.moe
* Access the Archive — that belongs to Broadcast, not Distribution

---

## Responsibilities

* Poll or listen for deliverables available in `Workshop/Terminal`
* Validate that the deliverable is approved and well-formed before handoff
* Route the deliverable to Dispatcher with release metadata
* Track retrieval state (delivered, pending, failed) per deliverable ID

---

## Interface (Planned)

```js
// Distribution/Retriever/retriever.js

/**
 * Lists all deliverables ready for Distribution in Terminal.
 * @returns {Deliverable[]}
 */
async function listReady() {
  return terminal.listReady();
}

/**
 * Retrieves a specific approved deliverable by ID.
 * @param {string} deliverableId
 * @returns {Deliverable | null}
 */
async function fetch(deliverableId) {
  const deliverable = await terminal.getReleaseMetadata(deliverableId);
  if (!deliverable) {
    log.warn(`[Retriever] deliverable ${deliverableId} not found in Terminal`);
    return null;
  }
  return deliverable;
}

/**
 * Hands off a deliverable to Dispatcher.
 * @param {Deliverable} deliverable
 */
async function handOff(deliverable) {
  if (!deliverable?.payload) {
    log.error(`[Retriever] malformed deliverable — abort handoff`);
    return;
  }
  await dispatcher.route(deliverable);
}
```

---

## Supplemental: Archival Retriever

A secondary retriever pattern handles **backfill and historical data** from external scrapers:

```js
// Archive raw responses for backfill jobs
// Normalize legacy formats into the canonical DATA_FORMAT
// Expose helpers for Refinery to read archived snapshots

async function backfill(trainerId) {
  const raw = await profileBackfill.fetch(trainerId);
  const normalized = normalizeToDataFormat(raw);
  return refinery.processLegacy(normalized);
}
```

Rules:
- Use `umaQueue` to space heavy scraping jobs
- Store archival copies separately from Vault (distinct adapter or path prefix)
- Never overwrite Vault records with backfill data without explicit operator approval

---

## Workflow

```text
Workshop/Terminal.listReady()
        │
        ▼
Retriever.fetch(deliverableId)
        │
        ▼
Retriever.handOff(deliverable)
        │
        ▼
Dispatcher.route(deliverable)
        │
        ▼
Discord channel or DM
```

---

## See Also

- `Workshop/Terminal/Terminal.md` — Terminal handoff interface
- `Distribution/README.md` — Distribution planned departments
- `umamoe/DATA_FORMAT.md` — Canonical data format for backfill normalization
