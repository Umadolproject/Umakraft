# UmaMoe Architecture Overview

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 1 — Umamoe (Extract, Transport, Validate & Store)
**Last Updated:** 2026-07-21

---

## Purpose

The **UmaMoe** directory is the heart of UmaKraft's data pipeline. It is responsible for communicating with the uma.moe service, processing the retrieved information, validating its integrity, storing it safely, and distributing it to other parts of the project.

Instead of using conventional software directory names such as `services`, `utils`, or `controllers`, UmaMoe is organized as a collection of specialized departments. Each department has a single responsibility and works together as part of one continuous workflow.

This architecture is designed to be:

* Easy to understand.
* Easy to maintain.
* Easy to expand.
* Consistent across the entire project.

## Core Philosophy

Every department has **one responsibility and one responsibility only**.

A department should never perform the work of another department. Information always moves forward through the pipeline, allowing every component to remain independent and predictable.

## Data Pipeline

```text
uma.moe
   │
   ▼
Miner
   │
   ▼
Courier
   │
   ▼
Inspector
   │
   ▼
Vault
```

## Department Overview

### Miner

Responsible for extracting raw information from the uma.moe API or other external sources.

### Courier

Responsible for transporting information between departments without modifying the data.

### Inspector

Responsible for validating, verifying, and ensuring the integrity of all incoming information before it is accepted.

### Vault

Responsible for securely storing and retrieving validated information for the rest of the project.

---

This document serves as the foundation of the UmaMoe architecture. Additional departments and responsibilities will be introduced only when they fulfill a unique purpose and do not overlap with existing departments.
