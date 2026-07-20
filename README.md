# UmaKraft

**Constitutional Data Pipeline Architecture**

A permanently structured, ownership-based architecture for data extraction, refinement, rendering, and delivery.

---

## 🏛️ Architecture

UmaKraft follows a **five-stage pipeline**:

```
Umamoe (Extract) 
    ↓
Refinery (Transform) 
    ↓
Workshop (Render) 
    ↓
Distribution (Route) 
    ↓
Broadcast (Deliver)
```

Each stage has **exclusive ownership** of its responsibility. Responsibilities never migrate backward. Architecture endures.

---

## 📖 Governance Documents

**START HERE:** All architectural decisions are governed by constitutional documents.

| Document | Purpose | Read First? |
|----------|---------|-------------|
| **GOVERNANCE/ARCHITECTURE_AUTHORITY.md** | Constitutional law; highest authority | ✅ YES |
| **GOVERNANCE/PIPELINE_REGISTRY.md** | Official register of departments & ownership | 📌 Essential |
| **GOVERNANCE/PIPELINE_OPERATIONS.md** | Operational standards & daily execution | 📌 Essential |
| **GOVERNANCE/PIPELINE_EVOLUTION.md** | How architecture evolves & absorbs modules | 📖 Reference |
| **GOVERNANCE/ARCHITECTURE_DECISIONS.md** | Historical ADR ledger | 📖 Reference |

**For AI Systems:** You MUST read `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` before generating code.

---

## 🔍 Quick Start by Role

### I'm Contributing Code

1. Read `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` (Articles XIV for AI)
2. Consult `GOVERNANCE/PIPELINE_REGISTRY.md` to find the responsible department
3. Extend that department rather than create new modules
4. Preserve pipeline direction and ownership

### I'm Adding a Feature

1. Identify the responsibility
2. Find the owner in `GOVERNANCE/PIPELINE_REGISTRY.md`
3. Check `GOVERNANCE/PIPELINE_EVOLUTION.md` for assimilation backlog
4. If no owner exists, propose an ADR

### I'm an AI Assistant

1. Read `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` Article XIV
2. Read `GOVERNANCE/PIPELINE_REGISTRY.md` before any implementation
3. Never merge departments
4. Never bypass pipeline stages
5. Extend existing ownership; don't duplicate
6. Update `GOVERNANCE/ARCHITECTURE_DECISIONS.md` for structural changes

### I'm Investigating a Bug

1. Determine which responsibility owns the bug (use `GOVERNANCE/PIPELINE_OPERATIONS.md` error routing)
2. Fix it in the responsible department
3. Do not move ownership to "fix" the bug
4. Preserve pipeline direction

---

## 📁 Repository Structure

```
UmaKraft/
│
├── GOVERNANCE/                          ← Constitutional authority (read first!)
│   ├── ARCHITECTURE_AUTHORITY.md       (Supreme law)
│   ├── PIPELINE_REGISTRY.md            (Department registry)
│   ├── PIPELINE_OPERATIONS.md          (Operational manual)
│   ├── PIPELINE_EVOLUTION.md           (Evolution rules)
│   ├── ARCHITECTURE_DECISIONS.md       (ADR ledger)
│   └── README.md                       (Governance guide)
│
├── umamoe/                              ← STAGE 1: Extract, Validate, Store
│   ├── Miner/                          (Extract from APIs)
│   ├── Courier/                        (Transport data)
│   ├── Inspector/                      (Validate structure)
│   ├── Vault/                          (Trusted storage)
│   └── README.md
│
├── Refinery/                            ← STAGE 2: Transform & Compile
│   ├── Refiner/                        (Normalize & derive)
│   ├── Compiler/                       (Assemble products)
│   ├── Depot/                          (Store products)
│   └── README.md
│
├── Workshop/                            ← STAGE 3: Render Presentation
│   ├── Draftsman/                      (Blueprint management)
│   ├── Fabricator/                     (Build embeds/cards)
│   ├── Validator/                      (Verify outputs)
│   ├── Terminal/                       (Staging area)
│   └── README.md
│
├── Distribution/                        ← STAGE 4: Route & Coordinate
│   ├── (commands/ & handlers/ pending formalization)
│   └── README.md
│
├── Broadcast/                           ← STAGE 5: Deliver Notifications
│   ├── Broker/                         (Trigger entry point)
│   ├── Inspector/                      (Approval authority)
│   ├── Archive/                        (Storage layer)
│   ├── Announcer/                      (Discord delivery)
│   └── README.md
│
├── INFRASTRUCTURE/                      ← Support systems (not stages)
│   ├── Adapters/                       (Interface adapters)
│   ├── Contracts/                      (Interface specs)
│   ├── Policy/                         (Rules & policies)
│   ├── Errors/                         (Error handling)
│   ├── Telemetry/                      (Logging & monitoring)
│   ├── core/                           (Shared utilities)
│   └── README.md
│
├── _TEMP/                               ← Temporary & legacy (awaiting home)
│   └── README.md
│
├── README.md                            ← You are here
├── package.json
├── .gitignore
└── ...
```

---

## 🎯 Core Principles

1. **Architecture Before Implementation** — Decide ownership first, code second
2. **Ownership is Exclusive** — One department per responsibility
3. **Pipeline Direction** — Forward only; never backward
4. **Protected Components** — Pipeline stages cannot be bypassed or merged
5. **Capability Acquisition** — Departments grow by absorbing related responsibilities
6. **Stability Over Speed** — Long-term architecture over short-term convenience

---

## 🔄 The Five Stages Explained

### Stage 1: UMAMOE (Extract, Validate, Store)

**Responsibility:** Acquire raw external data and store it safely

- **Miner** → Extract from APIs
- **Courier** → Transport unchanged
- **Inspector** → Validate structure
- **Vault** → Trusted persistence

**Never Owns:** Rendering, notifications, business rules

**Next Stage:** Refinery

---

### Stage 2: REFINERY (Transform & Compile)

**Responsibility:** Transform raw data into canonical products

- **Refiner** → Normalize and derive values
- **Compiler** → Assemble into products
- **Depot** → Store compiled products

**Never Owns:** Validation, rendering, API requests

**Depends On:** Umamoe (Vault)  
**Next Stage:** Workshop, Broadcast

---

### Stage 3: WORKSHOP (Render Presentation)

**Responsibility:** Generate Discord-ready embeds, images, and cards

- **Draftsman** → Define blueprint specs
- **Fabricator** → Build presentation assets
- **Validator** → Verify completeness
- **Terminal** → Stage for distribution

**Never Owns:** Data validation, API requests, notifications

**Depends On:** Refinery (Depot)  
**Next Stage:** Distribution

---

### Stage 4: DISTRIBUTION (Route & Coordinate)

**Responsibility:** Route commands and coordinate application responses

- **Retriever** → Pull from Workshop/Terminal
- **Dispatcher** → Route to Discord

**Status:** Pending formalization (currently `commands/` & `handlers/`)

**Next Stage:** Broadcast

---

### Stage 5: BROADCAST (Deliver Notifications)

**Responsibility:** Manage notification lifecycle from trigger through delivery

- **Broker** → Trigger entry; fetch data
- **Inspector** → Approval authority; eligibility check
- **Archive** → Persistent notification storage
- **Announcer** → Discord delivery

**Never Owns:** Data extraction, validation

**Depends On:** Refinery (Depot)

---

## ⚙️ How It Works

### Data Flow Example

```
1. Trigger Event (scheduled or threshold)
                    ↓
2. Broker retrieves compiled data from Refinery/Depot
                    ↓
3. Inspector checks eligibility & deduplication
                    ↓
4. Archive stores notification record
                    ↓
5. Announcer fetches from Archive and delivers to Discord
                    ↓
6. Archive updates delivery status
```

### Feature Request Example

```
Feature: Add a new report type

Step 1: Identify responsibility
        → Rendering = Workshop/Fabricator

Step 2: Extend existing department
        → Add new blueprint to Workshop/Draftsman/Blueprint/
        → Add new render function to Workshop/Fabricator/reports/

Step 3: Verify pipeline flow
        → No ownership change needed
        → No new departments needed

Step 4: Test end-to-end
        → Feature complete
```

---

## 📋 Checklist for Contributors

Before opening a PR:

- [ ] Read `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
- [ ] Identified the responsible department
- [ ] Extended existing department (not created new module)
- [ ] Preserved pipeline direction
- [ ] Maintained architectural boundaries
- [ ] Updated `GOVERNANCE/ARCHITECTURE_DECISIONS.md` (if structural change)
- [ ] No duplicate ownership created
- [ ] Tests pass

---

## 🚀 Getting Started

### Setup

```bash
npm install
npm run lint
npm run test
```

### Development

```bash
# Run linter
npm run lint:fix

# Format code
npm run format

# Run tests
npm test

# Start application
npm start
```

---

## 📚 Documentation by Purpose

| I want to... | Read This |
|---|---|
| Understand the supreme law | `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` |
| Find who owns a responsibility | `GOVERNANCE/PIPELINE_REGISTRY.md` |
| Learn how to operate the pipeline | `GOVERNANCE/PIPELINE_OPERATIONS.md` |
| See how architecture evolves | `GOVERNANCE/PIPELINE_EVOLUTION.md` |
| Review architectural decisions | `GOVERNANCE/ARCHITECTURE_DECISIONS.md` |
| Understand Miner/Courier/Inspector/Vault | `umamoe/README.md` |
| Understand Refiner/Compiler/Depot | `Refinery/README.md` |
| Understand Draftsman/Fabricator/Validator | `Workshop/README.md` |
| Learn about support infrastructure | `INFRASTRUCTURE/README.md` |

---

## 🤝 Contributing

This repository follows strict architectural governance. All contributions must respect:

1. **Ownership** — Only extend existing departments
2. **Direction** — Pipeline flows forward only
3. **Protection** — Don't rename or merge departments
4. **Documentation** — Update governance docs for structural changes

For detailed contribution guidelines, see `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` Article XIV (AI Governance).

---

## 📞 Questions?

Consult the governance documents in order:

1. `GOVERNANCE/README.md` — Overview
2. `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` — Supreme law
3. `GOVERNANCE/PIPELINE_REGISTRY.md` — Department specs
4. `GOVERNANCE/PIPELINE_OPERATIONS.md` — Daily operations

---

## ✨ Architecture Principles

> **Architecture Before Implementation** — Decide ownership first, code second  
> **Ownership is Exclusive** — One department per responsibility  
> **Pipeline Direction** — Forward only; never backward  
> **Protected Components** — Pipeline stages are permanent  
> **Capability Acquisition** — Departments grow by absorbing responsibilities  
> **Stability Over Speed** — Long-term integrity over convenience  

---

**Last Updated:** 2026-07-20  
**Version:** 1.0.0  
**Authority:** Repository Owner
