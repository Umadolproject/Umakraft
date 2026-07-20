# ARCHITECTURE_DECISIONS.md

**Document Status:** Official Architecture Decision Record (ADR) Ledger
**Authority Level:** Repository Historical Record
**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**References:** `PIPELINE_REGISTRY.md`, `PIPELINE_OPERATIONS.md`, `PIPELINE.md`
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

```text id="5s4t8n"
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

# Decision Categories

Architectural decisions are grouped into the following categories:

* Pipeline
* Ownership
* Dependency
* Interface
* Data Flow
* Storage
* Security
* Performance
* Reliability
* Documentation
* Governance
* Refactoring
* Infrastructure

---

# ADR Template

Every architectural decision shall use the following format.

```text id="z1b7c4"
ADR-XXXX

Title:

Status:

Category:

Date:

Author:

Approved By:

Related Documents:

Summary:

Context:

Problem Statement:

Decision:

Alternatives Considered:

Architectural Impact:

Affected Components:

Benefits:

Risks:

Migration Plan:

Implementation Status:

Rollback Strategy:

Notes:
```

---

# ADR Numbering

Architecture Decision Records use sequential numbering.

Examples:

```text id="f6m9w2"
ADR-0001

ADR-0002

ADR-0003

ADR-0004
```

Numbers are never reused.

Deleted numbers are not permitted.

---

# Sample Decision

---

## ADR-0001

### Title

Establish Constitutional Governance Documents

### Status

IMPLEMENTED

### Category

Governance

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* ARCHITECTURE_AUTHORITY.md
* PIPELINE_REGISTRY.md
* PIPELINE_OPERATIONS.md

### Summary

Introduce a constitutional governance layer above the implementation architecture.

### Context

As the repository expanded, architectural ownership became more important than individual implementations.

Without governance, contributors and AI assistants could unintentionally duplicate responsibilities, merge departments, or bypass pipeline stages.

### Problem Statement

The repository lacked a permanent architectural authority.

Implementation documentation alone could not prevent structural drift.

### Decision

Create four constitutional governance documents.

* Architecture Authority
* Pipeline Registry
* Pipeline Operations
* Architecture Decisions

These documents become the official governance framework.

### Alternatives Considered

Continue using implementation documentation only.

Rejected because implementation documentation explains components but does not govern architectural behavior.

### Architectural Impact

High

Introduces permanent governance above implementation.

### Affected Components

Entire Repository

### Benefits

* Stable architecture
* Consistent ownership
* Better AI guidance
* Reduced architectural drift
* Improved long-term maintainability

### Risks

Minimal.

Requires contributors to update governance documentation when architecture changes.

### Migration Plan

No code changes required.

Documentation becomes immediately effective.

### Implementation Status

Completed.

### Rollback Strategy

Not recommended.

Removing governance would weaken architectural consistency.

### Notes

This ADR establishes the constitutional foundation of the repository.

---

## ADR-0002

### Title

Add ESLint and Prettier Code Quality Tooling

### Status

IMPLEMENTED

### Category

Governance

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `eslint.config.js`
* `.prettierrc`

### Summary

Introduce ESLint and Prettier as the standard linting and formatting tools for the repository.

### Context

The codebase lacked enforced code style and static analysis. As the repository grew, inconsistent formatting and uncaught lint errors became a maintenance burden.

### Problem Statement

No automated enforcement of code quality or consistent style existed.

### Decision

Add ESLint with `@eslint/js` and `eslint-config-prettier`, and Prettier for formatting. Add `npm run lint`, `npm run lint:fix`, and `npm run format` scripts.

### Alternatives Considered

No tooling — rejected because code quality degrades without enforcement.

### Architectural Impact

Low. No runtime behavior changes.

### Affected Components

All source files.

### Benefits

* Consistent code style
* Early detection of common errors
* Improved readability

### Risks

Minimal. Existing code may require formatting passes.

### Implementation Status

Completed.

### Rollback Strategy

Remove dev dependencies and config files.

---

## ADR-0003

### Title

Add JSDoc Typing with @ts-check

### Status

IMPLEMENTED

### Category

Documentation

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `core/config.js`, `core/log.js`, `core/store.js`

### Summary

Add `// @ts-check` and JSDoc type annotations to core modules and all new files.

### Decision

Adopt `// @ts-check` at the top of files with JSDoc `@param` and `@returns` annotations. Does not require TypeScript compilation.

### Architectural Impact

Low. Improves IDE support and catches type errors at edit time.

### Implementation Status

Completed. Applied to `core/config.js`, `core/log.js`, `core/store.js`, and all new files.

---

## ADR-0004

### Title

Create Repository Abstraction Layer

### Status

IMPLEMENTED

### Category

Architecture

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `repositories/linkRepository.js`, `repositories/memberRepository.js`, `repositories/stateRepository.js`

### Summary

Introduce a repository abstraction layer to decouple data access from business logic.

### Decision

Create `repositories/linkRepository.js`, `memberRepository.js`, and `stateRepository.js`. All domain code accesses data through these repositories rather than directly.

### Architectural Impact

Medium. Establishes the data access pattern for Refinery/Depot.

### Implementation Status

Completed.

---

## ADR-0005

### Title

Migrate links.json to SQLite

### Status

IMPLEMENTED

### Category

Storage

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `db/linksDb.js`, `fantracking/links/db.js`

### Summary

Replace the flat `links.json` file with a SQLite database. Auto-import existing data on first boot.

### Decision

Create `db/linksDb.js` with auto-import from `links.json` on first boot. `core/store.js` delegates to the SQLite layer transparently. The old JSON file is kept as a backup.

### Architectural Impact

Medium. Persistent storage is now SQLite-backed. Downstream code is unchanged.

### Implementation Status

Completed.

---

## ADR-0006

### Title

Add SQLite Schema Indexing

### Status

IMPLEMENTED

### Category

Performance

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `db/migrations.js`

### Summary

Add indexes to SQLite databases and wire a migrations runner to all DB initializations.

### Decision

Add `idx_links_viewer` index to `links.db`. Wire `db/migrations.js` migration runner to all DB initializations.

### Architectural Impact

Low. Query performance improvement. No behavior change.

### Implementation Status

Completed.

---

## ADR-0007

### Title

Centralized Database Migration System

### Status

IMPLEMENTED

### Category

Infrastructure

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `db/migrations.js`

### Summary

Create a reusable migration runner with a `_migrations` tracking table per database.

### Decision

`db/migrations.js` provides a `runMigrations(db, migrations)` function. Every database initialization calls this runner. Migration history is stored in a `_migrations` table.

### Architectural Impact

Medium. All future schema changes must go through this runner.

### Implementation Status

Completed.

---

## ADR-0008

### Title

Centralize Async Error Handling

### Status

IMPLEMENTED

### Category

Reliability

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `core/errors.js`

### Summary

Introduce `safeRun()` and `withRetry()` utilities in `core/errors.js` for consistent async error handling with exponential backoff.

### Decision

`core/errors.js` exports `safeRun(fn)` for safe execution and `withRetry(fn, options)` for exponential backoff retry. All pipeline operations use these utilities.

### Architectural Impact

Medium. Standardizes error handling and retry logic across all departments.

### Implementation Status

Completed.

---

## ADR-0009

### Title

Task and Job Registry

### Status

IMPLEMENTED

### Category

Reliability

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `core/taskRegistry.js`

### Summary

Introduce a task registry to track last run, success/failure, and consecutive failure counts for all 25 scheduled tasks.

### Decision

`core/taskRegistry.js` maintains a runtime registry of all tasks. The `/health` endpoint exposes registry stats.

### Architectural Impact

Low. Observability improvement. No behavior change.

### Implementation Status

Completed.

---

## ADR-0010

### Title

Health Endpoint Improvements

### Status

IMPLEMENTED

### Category

Reliability

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `core/health.js`

### Summary

Expand the `/health` endpoint to expose task registry stats, heap/RSS memory, and active circle count.

### Decision

`core/health.js` now includes task registry data, memory metrics, and circle status in the health response.

### Architectural Impact

Low. Operational observability improvement.

### Implementation Status

Completed.

---

## ADR-0011

### Title

Automated SQLite Backup

### Status

IMPLEMENTED

### Category

Reliability

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `tasks/sqliteBackup.js`

### Summary

Schedule a nightly backup of all SQLite database files, retaining the last 7 days.

### Decision

`tasks/sqliteBackup.js` runs at 03:30 JST, copies all `*.db` files to a backup directory, and prunes backups older than 7 days.

### Architectural Impact

Low. Data safety improvement.

### Implementation Status

Completed.

---

## ADR-0012

### Title

Remove Unused Audio Dependencies

### Status

IMPLEMENTED

### Category

Refactoring

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Summary

Uninstall `@discordjs/voice`, `ffmpeg-static`, `libsodium-wrappers`, and `opusscript` — zero import references found.

### Decision

Remove all four packages from `package.json`. No replacement needed.

### Architectural Impact

Low. Reduces install size. No functionality removed.

### Implementation Status

Completed.

---

## ADR-0013

### Title

Introduce Integration Test Suite

### Status

IMPLEMENTED

### Category

Reliability

### Date

2026-07-19

### Author

Repository Owner

### Approved By

Repository Owner

### Related Documents

* `tests/links.test.js` (7 tests)
* `tests/milestone.test.js` (12 tests)
* `Refinery/tests/refiner.test.js`
* `Refinery/tests/vault.test.js`

### Summary

Add a Vitest-based integration test suite. `npm test` runs all tests.

### Decision

Use Vitest as the test runner. Initial suite: `tests/links.test.js` (7 tests), `tests/milestone.test.js` (12 tests). Refinery tests added in `Refinery/tests/`.

### Architectural Impact

Low. Quality gate improvement.

### Implementation Status

Completed. 19/19 tests passing at time of merge.

---

# Architectural Review Process

Every proposed structural change shall follow this process.

```text id="h8v2kq"
Proposal
        │
        ▼
Architecture Review
        │
        ▼
Impact Analysis
        │
        ▼
Owner Approval
        │
        ▼
ADR Creation
        │
        ▼
Implementation
        │
        ▼
Registry Update
        │
        ▼
Operations Update
```

No implementation shall precede its approved architectural decision when the change affects ownership or pipeline structure.

---

# Changes That Require an ADR

The following changes require an Architecture Decision Record:

* Adding a new pipeline department.
* Removing a department.
* Renaming a department.
* Changing ownership.
* Modifying pipeline order.
* Introducing new architectural stages.
* Changing dependency rules.
* Changing governance documents.
* Introducing shared infrastructure that affects multiple stages.
* Altering public interfaces between departments.

Routine bug fixes and internal refactoring do not require ADRs unless they alter architectural responsibilities.

---

# Architectural Review Checklist

Before approving a decision:

* [ ] Does an existing department already own this responsibility?
* [ ] Does the decision preserve pipeline direction?
* [ ] Does it avoid duplicate ownership?
* [ ] Does it respect protected departments?
* [ ] Does it introduce unnecessary coupling?
* [ ] Does it improve maintainability?
* [ ] Has the registry been updated?
* [ ] Have operational impacts been documented?
* [ ] Has the Repository Owner approved the change?

---

# Superseding Decisions

When an ADR replaces another:

* The original ADR remains unchanged.
* The new ADR references the previous ADR.
* The previous ADR status becomes `SUPERSEDED`.
* Historical reasoning is preserved.

Architecture evolves through documented decisions, not rewritten history.

---

# Repository Timeline

This section provides a high-level chronology of significant architectural milestones.

| Date       | ADR      | Event                                                    |
| ---------- | -------- | -------------------------------------------------------- |
| 2026-07-19 | ADR-0001 | Constitutional governance framework established          |
| 2026-07-19 | ADR-0002 | ESLint + Prettier code quality tooling added             |
| 2026-07-19 | ADR-0003 | JSDoc typing with @ts-check adopted                      |
| 2026-07-19 | ADR-0004 | Repository abstraction layer created                     |
| 2026-07-19 | ADR-0005 | links.json migrated to SQLite                            |
| 2026-07-19 | ADR-0006 | SQLite schema indexing and migrations runner added       |
| 2026-07-19 | ADR-0007 | Centralised database migration system established        |
| 2026-07-19 | ADR-0008 | Async error handling centralised in core/errors.js       |
| 2026-07-19 | ADR-0009 | Task and job registry introduced                         |
| 2026-07-19 | ADR-0010 | Health endpoint expanded with task registry and memory   |
| 2026-07-19 | ADR-0011 | Automated nightly SQLite backup scheduled                |
| 2026-07-19 | ADR-0012 | Unused audio dependencies removed                        |
| 2026-07-19 | ADR-0013 | Vitest integration test suite introduced                 |

---

# Governance Compliance

Every architectural decision must remain consistent with:

1. `ARCHITECTURE_AUTHORITY.md`
2. `PIPELINE_REGISTRY.md`
3. `PIPELINE_OPERATIONS.md`

If a proposed decision conflicts with these documents, it must first amend the relevant governing document through an approved ADR.

---

# Final Statement

Architecture is not only built through code.

It is built through deliberate decisions.

This ledger preserves those decisions so that future contributors understand not only **what** the architecture became, but **why** it became that way.

Every major architectural change leaves a permanent record.

Every record strengthens the continuity, stability, and long-term evolution of the UmaKraft repository.
