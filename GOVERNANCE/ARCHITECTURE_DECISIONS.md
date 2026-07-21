# ARCHITECTURE_DECISIONS.md

**Document Status:** Official Architecture Decision Record (ADR) Ledger
**Authority Level:** Repository Historical Record
**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**References:** `PIPELINE_REGISTRY.md`, `PIPELINE_OPERATIONS.md`
**Version:** 1.0.0
**Last Updated:** 2026-07-19

---

# Purpose

This document serves as the permanent historical record of architectural decisions for the UmaKraft repository.

Its purpose is to preserve the reasoning behind structural changes so future contributors understand **why** the architecture evolved.

Unlike Git commits, Architecture Decision Records (ADRs) explain the architectural intent, trade-offs, and impact of a decision.

No architectural change is considered complete until it is recorded in this document.

---

# Decision Principles

Every Architecture Decision Record shall:

* Have a unique identifier.
* Record the decision date.
* Identify the decision owner.
* Explain the motivation.
* Describe considered alternatives.
* Assess architectural impact.
* Document implementation status.
* Preserve historical context.

Architecture history shall never be rewritten.

Superseded decisions remain part of the historical record.

---

# Decision Status

Each ADR must have one of the following statuses:

```text
PROPOSED

UNDER REVIEW

ACCEPTED

IMPLEMENTED

SUPERSEDED

DEPRECATED

REJECTED
```

Statuses may only move forward.

Historical entries must never be deleted.

---

# ADR-0001

## Title

Establish Constitutional Governance Documents

## Status

IMPLEMENTED

## Category

Governance

## Date

2026-07-20

## Author

Repository Owner

## Summary

Move governance documents from root to GOVERNANCE/ folder for better organization.

## Decision

All constitutional governance documents moved to dedicated GOVERNANCE/ folder to keep root clean and improve discoverability by AI systems.

## Architectural Impact

Low. Organizational change only; no functionality affected.

## Implementation Status

Completed on branch: reorganize/step1-governance-folder

---

# ADR-0002

## Title

Formalize Distribution Stage with Three Departments: Commands, Coordinator, Dispatcher

## Status

IMPLEMENTED

## Category

Architecture

## Date

2026-07-21

## Author

Repository Owner

## Summary

Formally establish the Distribution stage (Stage 4) with three owned departments replacing the prior unformalized state.

## Decision

Distribution is formalized with the following department structure:

* **Commands** — sole entry point for Discord slash command events; owns input validation and routing to Coordinator.
* **Coordinator** — sole department authorized to call upstream pipeline stages (Umamoe, Refinery, Workshop); owns orchestration and deliverable retrieval from Workshop/Terminal.
* **Dispatcher** — sole department authorized to deliver responses outward to Discord; owns destination resolution and Discord payload formatting.

Prior planned departments (`Retriever`, `Dispatcher` as previously noted) are superseded by this formalization. The three-department model (Commands → Coordinator → Dispatcher) reflects the "customer service" flow: intake, fulfillment, delivery.

## Architectural Impact

Medium. Distribution moves from PENDING FORMALIZATION to FORMALIZED. The `PIPELINE_REGISTRY.md` Stage 4 section is updated to register all three departments with full ownership, interface, and downstream entries. `ARCHITECTURE_AUTHORITY.md` Article III protected components list for Distribution is now backed by concrete departments.

## Implementation Status

Directory structure created: `Distribution/Commands/`, `Distribution/Coordinator/`, `Distribution/Dispatcher/`. Department role documents written for each. `Distribution/README.md` updated. `PIPELINE_REGISTRY.md` updated.

---

# ADR-0003

## Title

Add Discord Department to Distribution as Platform Adapter Layer

## Status

IMPLEMENTED

## Category

Architecture

## Date

2026-07-21

## Author

Repository Owner

## Summary

Introduce a dedicated `Discord/` department within Distribution to own all raw Discord API files, separating platform concerns from pipeline logic.

## Decision

A **Discord** department is established at the `Distribution/Discord/` path as a platform adapter. It contains two subdirectories:

* `events/` — one file per Discord gateway event handler (receives raw events, forwards to Commands)
* `commands/` — one file per slash command definition registered with the Discord API (declarations only, no handler logic)

Both Commands and Dispatcher may consume shared Discord utilities from this department. Neither department directly owns Discord API files.

## Rationale

Commands (intake) and Dispatcher (delivery) both interface with Discord but for different purposes. Without a shared platform layer, Discord API concerns would spread across two departments, violating the single-ownership principle. Centralizing all raw Discord API surface in one department keeps Commands and Dispatcher platform-agnostic in their logic.

## Architectural Impact

Medium. A new department is registered in Stage 4. `PIPELINE_REGISTRY.md` updated with full Discord department entry. `Distribution/README.md` updated. No existing department ownership is changed.

## Implementation Status

Directory structure created: `Distribution/Discord/`, `Distribution/Discord/events/`, `Distribution/Discord/commands/`. Department role documents written. Registry and README updated.

---

# ADR-0004

## Title

Define Club Gain Blueprint for `/club_gain` Command

## Status

IMPLEMENTED

## Category

Blueprint Definition

## Date

2026-07-21

## Author

Repository Owner

## Summary

Introduce a formal blueprint for the `/club_gain` command at `Workshop/Draftsman/Blueprint/club_gain.md`, governing how a 30-day club fan gain history is rendered and delivered via Discord.

## Decision

A **club_gain** blueprint is established at `Workshop/Draftsman/Blueprint/club_gain.md` as the authoritative rendering specification for the `/club_gain` Discord command. The blueprint defines:

* Canvas dimensions: 1080 × 1350 px (4:5), background `#FFF8FB`
* Four sections: Header (1000×140), Spreadsheet Table (1000×840), Summary Statistics (1000×200), Footer (1000×30)
* Spreadsheet table displays up to 30 rows of date / daily gain / running total
* Summary block: total gain, average, highest, and lowest single-day gain
* Full pipeline ownership assignment across all five stages
* Data contract (meta, rows, summary) for Fabricator consumption
* Error handling responses for no data, invalid club, and permission denied

The command accepts two optional parameters: `club` (admin-only alternate club) and `days` (1–30, default 30). Results are cached for 10 minutes and must render within 2 seconds.

## Rationale

The `/club_gain` command represents a distinct deliverable type — a multi-row tabular history rather than a single-snapshot metric card. A dedicated blueprint is required so Draftsman, Fabricator, and Validator each have an unambiguous specification to reference. Without this blueprint, rendering logic would lack a constitutional anchor, violating the Workshop governance standard that requires every deliverable type to be blueprint-defined before implementation.

## Architectural Impact

Low. No existing department ownership changes. A new blueprint file is added to `Workshop/Draftsman/Blueprint/`. The Draftsman registry entry in `PIPELINE_REGISTRY.md` should be updated to include `club_gain.md` in its blueprint list.

## Implementation Status

Blueprint file created: `Workshop/Draftsman/Blueprint/club_gain.md`. Fabricator implementation and Coordinator action pending.

---

# Governance Compliance

Every architectural decision must remain consistent with:

1. `ARCHITECTURE_AUTHORITY.md`
2. `PIPELINE_REGISTRY.md`
3. `PIPELINE_OPERATIONS.md`
