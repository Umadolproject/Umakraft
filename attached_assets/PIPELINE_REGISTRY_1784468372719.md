# PIPELINE_REGISTRY.md

**Document Status:** Official Pipeline Registry
**Authority Level:** Constitutional Registry
**Governed By:** `ARCHITECTURE_AUTHORITY.md`
**Version:** 1.0.0
**Last Updated:** 2026-07-19

---

# Purpose

The Pipeline Registry is the official catalogue of every architectural department within this repository.

Its purpose is to establish ownership, define responsibilities, document interfaces, and preserve architectural boundaries.

Every component registered here is considered an official department of the UmaKraft architecture.

This registry is the authoritative source for determining where new functionality belongs.

---

# Repository Pipeline

```text
Repository

    ▼

Umamoe
    ▼
Refinery
    ▼
Workshop
    ▼
Distribution
    ▼
Broadcast
```

Every stage has a defined purpose.

No stage may bypass another without explicit architectural approval.

---

# Ownership Rules

Each department has one owner.

Each responsibility has one owner.

One responsibility must never have multiple architectural owners.

If a responsibility already exists inside a department, new implementations shall extend that department rather than duplicate it elsewhere.

---

# ============================================================

# STAGE 1 — UMAMOE

# ============================================================

## Miner

### Purpose

Acquire raw external information.

### Owns

* API communication
* Data extraction
* Scraping
* Remote endpoints
* Request scheduling
* Raw response collection

### Receives

* Feature requests
* Extraction jobs

### Produces

* Raw Data Envelope

### Never Owns

* Validation
* Persistence
* Rendering
* Discord
* Notifications

### Downstream

Courier

---

## Courier

### Purpose

Transport pipeline data.

### Owns

* Envelope routing
* Pipeline transport
* Queue transfer
* Data forwarding

### Receives

Raw Data Envelope

### Produces

Transport Envelope

### Never Owns

* Business rules
* Validation
* Storage
* Rendering

### Downstream

Inspector

---

## Inspector

### Purpose

Validate incoming pipeline data.

### Owns

* Validation
* Schema verification
* Required fields
* Data integrity
* Error classification

### Receives

Transport Envelope

### Produces

Validated Envelope

### Never Owns

* Storage
* Rendering
* Notifications
* Database writes

### Downstream

Vault

---

## Vault

### Purpose

Trusted persistence layer.

### Owns

* Storage
* Persistence
* Recovery
* Version history
* Snapshot management

### Receives

Validated Envelope

### Produces

Trusted Pipeline Record

### Never Owns

* Validation
* Rendering
* Notifications
* API requests

### Downstream

Refinery

---

# ============================================================

# STAGE 2 — REFINERY

# ============================================================

## Refiner

### Purpose

Transform trusted records into refined domain information.

### Owns

* Normalization
* Cleaning
* Derived values
* Domain refinement

### Receives

Trusted Pipeline Record

### Produces

Refined Result

---

## Compiler

### Purpose

Assemble refined results into canonical products.

### Owns

* Product assembly
* Merge rules
* Provenance
* Canonical schemas
* Product generation

### Receives

Refined Result

### Produces

Compiled Product

---

## Depot

### Purpose

Store compiled products.

### Owns

* Product persistence
* Retrieval
* Version lookup
* Product retention

### Receives

Compiled Product

### Produces

Stored Product

### Consumers

Workshop

Broadcast

---

# ============================================================

# STAGE 3 — WORKSHOP

# ============================================================

## Workshop

### Purpose

Generate presentation artifacts.

### Owns

* Rendering
* Templates
* Cards
* Images
* Embeds
* Reports

### Receives

Compiled Product

### Produces

Presentation Assets

### Never Owns

* API extraction
* Validation
* Notification decisions

---

# ============================================================

# STAGE 4 — DISTRIBUTION

# ============================================================

## Distribution

### Purpose

Coordinate user-facing application flow.

### Owns

* Routing
* Commands
* Scheduling
* State coordination
* Request orchestration

### Receives

Presentation Assets

### Produces

Application Responses

---

# ============================================================

# STAGE 5 — BROADCAST

# ============================================================

## Broker

### Purpose

Broadcast entry point.

### Owns

* Scheduled triggers
* Queue management
* Data retrieval
* Notification job creation

### Receives

Trigger

### Produces

Notification Envelope

### Never Owns

Eligibility

Decision making

---

## Broadcast Inspector

### Purpose

Notification approval authority.

### Owns

* Eligibility
* Deduplication
* Recipient resolution
* Variant selection
* Archive creation

### Receives

Notification Envelope

### Produces

Approved Notification

### Never Owns

Discord delivery

---

## Archive

### Purpose

Persistent notification storage.

### Owns

* Notification records
* Delivery state
* Retry state
* History

### Receives

Approved Notification

### Produces

Stored Notification

---

## Announcer

### Purpose

Deliver approved notifications.

### Owns

* Discord delivery
* Retry execution
* Delivery status
* Completion updates

### Receives

Stored Notification

### Produces

Delivered Notification

---

# Architectural Ownership Matrix

| Responsibility        | Owner               |
| --------------------- | ------------------- |
| API Extraction        | Miner               |
| Raw Transport         | Courier             |
| Validation            | Inspector           |
| Trusted Storage       | Vault               |
| Data Refinement       | Refiner             |
| Product Assembly      | Compiler            |
| Product Storage       | Depot               |
| Rendering             | Workshop            |
| Application Routing   | Distribution        |
| Broadcast Trigger     | Broker              |
| Notification Approval | Broadcast Inspector |
| Notification Archive  | Archive             |
| Discord Delivery      | Announcer           |

---

# Dependency Contract

Every department may only communicate with approved architectural neighbors.

Forward movement is encouraged.

Backward ownership is prohibited.

Allowed

```text
Miner
    ↓
Courier
    ↓
Inspector
    ↓
Vault
```

Allowed

```text
Compiler
    ↓
Depot
```

Allowed

```text
Broker
    ↓
Broadcast Inspector
    ↓
Archive
    ↓
Announcer
```

Forbidden

```text
Workshop
    ↓
Miner
```

Forbidden

```text
Vault
    ↓
Workshop
```

Forbidden

```text
Announcer
    ↓
Inspector
```

---

# Pipeline Expansion Rules

New departments may only be introduced when:

* no existing department owns the responsibility,
* ownership is clearly defined,
* dependencies remain directional,
* the Repository Owner approves the addition,
* the new department is registered here before implementation.

---

# Registration Template

Every new department must include:

```text
Department Name:

Stage:

Purpose:

Owner:

Inputs:

Outputs:

Interfaces:

Dependencies:

Consumers:

Protected:

Version:

Status:
```

---

# Registry Compliance Checklist

Before implementing any feature, verify:

* [ ] Correct owner identified.
* [ ] No duplicate responsibility exists.
* [ ] Dependencies remain directional.
* [ ] Interfaces are documented.
* [ ] Downstream consumers are identified.
* [ ] No protected department is modified.
* [ ] Registry updated if architecture changes.

---

# Registry Maintenance

This document is maintained by the Repository Owner.

Any architectural modification affecting ownership, interfaces, responsibilities, or dependencies must update this registry.

Changes to this registry must also be recorded in `ARCHITECTURE_DECISIONS.md`.

Failure to update this registry results in the architecture being considered out of compliance.

---

# Final Statement

The Pipeline Registry is the architectural map of the repository.

It defines ownership before implementation, responsibility before code, and structure before expansion.

Every feature begins here.

Every architectural decision is validated against this registry.

If the registry and implementation disagree, the registry is considered the intended architecture until an approved amendment updates both.
