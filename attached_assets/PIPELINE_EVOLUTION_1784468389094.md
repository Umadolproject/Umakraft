# PIPELINE_EVOLUTION.md

**Document Status:** Official Pipeline Evolution Standard
**Authority Level:** Repository Evolution Policy
**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**References:** `PIPELINE_REGISTRY.md`, `PIPELINE_OPERATIONS.md`, `ARCHITECTURE_DECISIONS.md`
**Version:** 1.0.0
**Last Updated:** 2026-07-19

---

# Mission

The purpose of this document is to define how the UmaKraft architecture evolves over time.

The repository shall evolve by strengthening existing architectural ownership rather than introducing unnecessary parallel systems.

Growth is encouraged.

Architectural drift is forbidden.

---

# Evolution Philosophy

The pipeline is a living architecture.

Departments may become more capable.

Departments shall not lose their identity.

The objective of evolution is:

* stronger ownership
* clearer responsibilities
* fewer duplicated modules
* simpler maintenance
* stable architecture

Architecture evolves through capability acquisition.

Architecture does not evolve through uncontrolled expansion.

---

# Core Principle

The Main Pipeline absorbs **responsibilities**, not folders.

Supporting modules exist to support the pipeline.

When a supporting module implements functionality already owned by a pipeline department, that responsibility should be integrated into the owning department.

Example

Current

```text id="8a8xgo"
utils/historyFetcher.js
```

Future

```text id="n9sbmi"
Umamoe/

    Miner/

        History/

            historyFetcher.js
```

The responsibility becomes part of Miner.

The utility folder is not the architectural owner.

---

# Evolution Hierarchy

```text id="h8n9hp"
Repository Owner
        │
        ▼
Architecture Authority
        │
        ▼
Pipeline Registry
        │
        ▼
Pipeline Departments
        │
        ▼
Supporting Modules
```

Lower levels strengthen higher levels.

Higher levels are never absorbed into lower levels.

---

# Capability Acquisition

Departments may acquire new capabilities when those capabilities belong to their established ownership.

Capability acquisition strengthens the architecture.

Ownership migration weakens the architecture.

---

# Department Expansion

## Miner

May absorb:

* API clients
* endpoint registries
* scrapers
* parsers
* request queues
* response caches
* history collectors
* extraction adapters
* endpoint authentication

Must never absorb:

* validation
* persistence
* rendering
* notification delivery

---

## Courier

May absorb:

* transport adapters
* message queues
* envelope builders
* routing helpers
* transport serialization

Must never absorb:

* business rules
* validation
* storage

---

## Inspector

May absorb:

* schema definitions
* validators
* rule engines
* sanitizers
* integrity checkers
* policy validators

Must never absorb:

* storage
* rendering
* API communication

---

## Vault

May absorb:

* storage adapters
* snapshots
* recovery managers
* version managers
* backup services
* persistence helpers

Must never absorb:

* extraction
* rendering
* delivery

---

## Refiner

May absorb:

* transformers
* normalizers
* enrichment modules
* calculators
* refinement rules

Must never acquire external communication.

---

## Compiler

May absorb:

* merge strategies
* product builders
* assemblers
* provenance generators
* template composition

Must never perform extraction or validation.

---

## Depot

May absorb:

* indexing
* retention
* cleanup jobs
* retrieval helpers
* storage optimization

Must never modify products.

---

## Workshop

May absorb:

* image rendering
* card generation
* report builders
* embed builders
* templates
* presentation layouts

Must never retrieve external data.

---

## Distribution

May absorb:

* command routing
* scheduling
* orchestration
* workflow dispatchers
* state coordination

Must never replace business ownership.

---

## Broker

May absorb:

* trigger adapters
* schedulers
* queue readers

Must never decide notification eligibility.

---

## Broadcast Inspector

May absorb:

* notification policies
* recipient selectors
* deduplication
* eligibility rules
* approval strategies

Must never deliver messages.

---

## Archive

May absorb:

* audit history
* retry history
* delivery metadata
* archival indexing

Must never generate notifications.

---

## Announcer

May absorb:

* Discord adapters
* retry execution
* delivery confirmation
* message formatting

Must never determine eligibility.

---

# Assimilation Process

Every supporting module shall be evaluated using the following process.

```text id="m8k9bp"
Supporting Module
        │
        ▼
Identify Responsibility
        │
        ▼
Lookup Owner
        │
        ▼
Owner Exists?
        │
   ┌────┴────┐
   │         │
 Yes        No
   │         │
   ▼         ▼
Integrate   Create ADR
into Owner  for New Owner
```

Responsibilities are assimilated.

Ownership remains stable.

---

# Modules Eligible for Assimilation

Examples include:

* utility modules
* helper libraries
* legacy scripts
* duplicate parsers
* experimental features
* endpoint wrappers
* validation helpers
* rendering helpers
* storage wrappers

Eligibility is determined by ownership, not by directory name.

---

# Forbidden Assimilation

The following operations are prohibited.

Merge two pipeline departments.

Example

```text id="m2q2nt"
Miner

+

Courier
```

Merge protected ownership.

Example

```text id="z2c0by"
Compiler

+

Depot
```

Collapse architectural stages.

Example

```text id="w0w4dl"
Refinery

↓

Workshop
```

Move protected departments into generic folders.

Example

```text id="s4z1pc"
Vault

↓

services/
```

Replace the pipeline with generic abstractions.

Forbidden examples:

```text id="zkj2qe"
PipelineManager

PipelineEngine

PipelineCore

UnifiedPipeline

MegaService
```

---

# Evolution Decision Matrix

| Situation                    | Action                                   |
| ---------------------------- | ---------------------------------------- |
| Responsibility already owned | Extend existing department               |
| Duplicate implementation     | Assimilate into owner                    |
| New responsibility           | Create ADR before implementation         |
| Temporary experiment         | Keep isolated until ownership is defined |
| Architectural conflict       | Escalate to Repository Owner             |

---

# AI Evolution Policy

Before creating a new module, AI assistants shall ask:

1. Does an owner already exist?
2. Is this responsibility already registered?
3. Can an existing department be extended?
4. Will this duplicate ownership?
5. Does this preserve pipeline integrity?

If the answer indicates an existing owner, AI shall extend that department rather than create a parallel implementation.

---

# Repository Growth Strategy

The long-term objective is to reduce architectural fragmentation.

Over time:

* utility folders become smaller,
* ownership becomes stronger,
* departments become richer,
* duplication decreases,
* interfaces become clearer,
* maintenance becomes simpler.

The architecture should mature by refining responsibilities rather than multiplying modules.

---

# Evolution Review Checklist

Before assimilating any module:

* [ ] Ownership confirmed.
* [ ] Registry reviewed.
* [ ] No duplicate owner exists.
* [ ] Interfaces preserved.
* [ ] Dependencies remain directional.
* [ ] Documentation updated.
* [ ] ADR required? (if ownership changes)
* [ ] Tests continue to pass.

---

# Final Statement

The UmaKraft architecture evolves through **capability acquisition**, not architectural replacement.

Protected pipeline departments are the permanent owners of their responsibilities.

Supporting modules are temporary structures that may be reorganized, deprecated, or assimilated when appropriate.

Every evolution should make the architecture clearer, simpler, and more maintainable.

The goal of evolution is not to create more modules.

The goal is to strengthen the existing architecture until every responsibility has one clear, permanent owner.
