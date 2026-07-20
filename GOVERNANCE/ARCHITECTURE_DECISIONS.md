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

# Governance Compliance

Every architectural decision must remain consistent with:

1. `ARCHITECTURE_AUTHORITY.md`
2. `PIPELINE_REGISTRY.md`
3. `PIPELINE_OPERATIONS.md`
