# ARCHITECTURE_AUTHORITY.md

**Document Status:** Constitutional Authority
**Authority Level:** Supreme Repository Law
**Version:** 1.0.0
**Effective Date:** 2026-07-19
**Maintainer:** Repository Owner

---

# Preamble

This document establishes the constitutional authority governing the architecture of this repository.

Its purpose is to preserve the long-term integrity, consistency, maintainability, and evolution of the UmaKraft architecture.

Every contributor, maintainer, automation, AI assistant, GitHub Copilot, CI workflow, script, and future development effort shall follow this document before making architectural decisions.

Implementation convenience shall never take precedence over architectural integrity.

When conflicts arise, this document is the highest authority.

---

# Article I — Constitutional Hierarchy

The repository shall follow the following order of authority.

```text
Repository Owner
        │
        ▼
ARCHITECTURE_AUTHORITY.md
        │
        ▼
Pipeline Specifications
        │
        ▼
Pipeline Components
        │
        ▼
Supporting Modules
        │
        ▼
Utilities
        │
        ▼
Individual Files
```

Lower levels may extend higher levels.

Lower levels shall never redefine higher levels.

---

# Article II — The Main Pipeline

The Main Pipeline is the permanent backbone of the repository.

It defines how information flows through the system.

The pipeline is not a collection of folders.

It is the architecture.

The current pipeline is:

```text
Umamoe
        │
        ▼
Refinery
        │
        ▼
Workshop
        │
        ▼
Distribution
        │
        ▼
Broadcast
```

No feature, module, or subsystem may bypass this architecture.

---

# Article III — Protected Components

The following components are constitutionally protected.

## Umamoe

* Miner — `umamoe/Miner/miner.js`
* Courier — `umamoe/Courier/courier.js`
* Inspector — `umamoe/Inspector/inspector.js`
* Vault — `umamoe/Vault/vault.js`, `umamoe/Vault/adapters/`

## Refinery

Every officially registered department.

* Refiner — `Refinery/Refiner/refiner.js`
* Compiler — `Refinery/Compiler/compiler.js`
* Depot — `Refinery/Depot/depot.js`

## Workshop

Every officially registered department.

* Draftsman — `Workshop/Draftsman/draftsman.js`, `Workshop/Draftsman/Blueprint/`
* Fabricator — `Workshop/Fabricator/fabricator.js`
* Validator — `Workshop/Validator/Validator.js`
* Terminal — `Workshop/Terminal/terminal.js`

## Distribution

Every officially registered department.

* Pending formalization — currently `commands/` (26 files) and `handlers/` (6 files)

## Broadcast

* Broker — `Broadcast/Broker/broker.js`
* Inspector — `Broadcast/archive-inspector/archiveInspector.js`
* Archive — `Broadcast/Archive/archive.js`
* Announcer — `Broadcast/Announcer/announcer.js`

These departments define architectural ownership.

They are not utility folders.

They are not optional.

---

# Article IV — Ownership Principle

Every responsibility within the repository has exactly one owner.

Ownership is exclusive.

Examples

Extraction

→ Miner

Validation

→ Inspector

Persistence

→ Vault

Compilation

→ Compiler

Notification Approval

→ Broadcast Inspector

Delivery

→ Announcer

If ownership already exists,

no duplicate implementation shall be created elsewhere.

---

# Article V — Single Responsibility Law

Each department owns one primary responsibility.

Departments may grow internally.

Departments may not absorb unrelated responsibilities.

Example

Allowed

```text
Miner/

    Scrapers/

    Endpoints/

    History/

    Queue/
```

Forbidden

```text
Miner/

    Discord/

    ImageRenderer/

    DatabaseMigration/
```

These belong elsewhere.

---

# Article VI — Pipeline Integrity

The architecture shall preserve directional flow.

Information moves forward.

Responsibilities do not move backward.

A downstream department shall never redefine upstream work.

Example

Broker transports.

Inspector decides.

Archive stores.

Announcer delivers.

Each department performs only its designated responsibility.

---

# Article VII — Dependency Rules

Dependencies shall always follow ownership.

Allowed

Supporting Module

↓

Pipeline Owner

Allowed

Workshop

↓

Refinery

Allowed

Broadcast

↓

Refinery

Forbidden

Vault

↓

Workshop

Forbidden

Miner

↓

Broadcast

Forbidden

Circular dependencies.

Forbidden

Bidirectional ownership.

---

# Article VIII — Protected Operations

The following operations require explicit approval from the Repository Owner.

* Rename a pipeline department.
* Delete a pipeline department.
* Merge pipeline departments.
* Split pipeline departments.
* Relocate pipeline departments.
* Replace pipeline departments.
* Change architectural ownership.
* Alter pipeline order.
* Introduce an alternative pipeline.
* Remove architectural boundaries.

No automated tool may perform these operations independently.

---

# Article IX — Pipeline Evolution

The architecture is permitted to evolve.

Evolution shall strengthen ownership.

Evolution shall not weaken ownership.

Permitted

* New files.
* New helpers.
* New adapters.
* New endpoints.
* New parsers.
* New caches.
* Internal refactoring.

Not permitted

* Ownership migration.
* Architectural collapse.
* Responsibility duplication.
* Pipeline replacement.
* Parallel architectures.

---

# Article X — Supporting Modules

Supporting modules exist to assist the pipeline.

Supporting modules may

* merge,
* split,
* reorganize,
* evolve,
* be deprecated,
* be replaced.

provided they do not violate pipeline ownership.

Supporting modules shall adapt to the pipeline.

The pipeline shall not adapt to supporting modules.

---

# Article XI — Pipeline Absorption

The Main Pipeline may absorb supporting functionality.

Example

```text
utils/historyFetcher.js

↓

Miner/History/
```

because history extraction belongs to Miner.

Supporting modules may never absorb protected pipeline departments.

Forbidden

```text
Vault/

↓

Database/
```

Forbidden

```text
Inspector/

↓

Utils/
```

Forbidden

```text
Broadcast/

↓

Services/
```

The pipeline always remains a first-class architectural structure.

---

# Article XII — Bug Ownership

Every defect belongs to a responsible owner.

Bug investigation shall determine ownership before proposing solutions.

Example

API failure

→ Miner

Validation error

→ Inspector

Persistence failure

→ Vault

Compilation conflict

→ Compiler

Notification approval

→ Broadcast Inspector

Delivery failure

→ Announcer

No bug shall be fixed by violating architectural ownership.

---

# Article XIII — Architectural Health

The repository shall continuously preserve:

* Clear ownership.
* Stable dependencies.
* No circular imports.
* No duplicate logic.
* No duplicate ownership.
* Clear interfaces.
* Complete documentation.
* Versioned architecture.

Architecture health has priority over feature velocity.

---

# Article XIV — AI Governance

All AI systems shall obey this authority.

Before generating code, an AI must:

1. Identify the architectural owner.
2. Determine the correct pipeline stage.
3. Verify dependency direction.
4. Reuse existing ownership.
5. Avoid duplicate logic.
6. Preserve interfaces.
7. Respect protected components.
8. Avoid architectural redesign unless explicitly instructed by the Repository Owner.

AI shall recommend extending existing departments before creating new ones.

---

# Article XV — Architectural Decisions

Architectural decisions shall be recorded.

Every approved structural modification shall include:

* Date
* Version
* Decision
* Reason
* Owner
* Affected Components
* Approval
* Impact Assessment

These records belong in `ARCHITECTURE_DECISIONS.md`.

No undocumented architectural change shall be considered permanent.

---

# Article XVI — Pipeline Registry

Every official department shall be registered.

The registry shall include:

* Department Name
* Purpose
* Owner
* Inputs
* Outputs
* Dependencies
* Consumers
* Interfaces
* Version
* Status

The registry is maintained in `PIPELINE_REGISTRY.md`.

---

# Article XVII — Repository Principles

This repository follows these constitutional principles.

1. Architecture before implementation.
2. Ownership before convenience.
3. Composition before duplication.
4. Determinism before shortcuts.
5. Documentation before assumptions.
6. Stability before expansion.
7. Clear responsibilities over shared responsibilities.
8. Explicit interfaces over hidden behavior.
9. Pipeline integrity over feature speed.
10. Long-term maintainability over short-term optimization.

---

# Article XVIII — Amendment Procedure

This document may only be amended by the Repository Owner.

Every amendment shall:

* receive an incremented version,
* include a rationale,
* identify affected articles,
* be recorded in `ARCHITECTURE_DECISIONS.md`,
* preserve backward architectural compatibility whenever possible.

AI assistants and contributors may propose amendments but may not enact them.

---

# Final Constitutional Statement

The architecture of this repository is a protected system.

Features evolve.

Modules evolve.

Implementations evolve.

The architecture endures.

Every contribution shall strengthen the architecture rather than redefine it.

When uncertainty exists, preserve the architecture.

When conflict exists, this document prevails.

The pipeline is not merely an implementation detail.

It is the constitutional foundation of the repository.
