# Umakraft AI Knowledge Service

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

The AI directory is the official technical specification for the Umakraft AI Knowledge Service — an independent, read-only intelligence subsystem dedicated to repository understanding, documentation assistance, Umamusume knowledge, and community message generation.

This subsystem has **no write access** to any part of the system. It reads. It explains. It generates community content. Nothing else.

---

## Core Principle

**Read Everything. Change Nothing.**

---

## Scope

| In Scope | Out of Scope |
|---|---|
| Repository question answering | Modifying source code |
| Repository search | Committing to GitHub |
| Blueprint explanation | Executing scripts |
| Governance explanation | Writing to databases |
| Architecture explanation | Discord administration |
| Fan Gain explanation | Accessing secrets or tokens |
| Umamusume knowledge | Answering off-topic questions |
| Community message generation | Performing moderation actions |
| Documentation assistance | Renaming or deleting files |

---

## Directory Structure

```text
AI/
│
├── README.md                  ← This file — overview and navigation
├── IMPLEMENTATION_PLAN.md     ← Phase-by-phase build plan
├── ARCHITECTURE.md            ← Full system architecture
│
├── REPOSITORY_ENGINE.md       ← Repository scanning and indexing engine
├── KNOWLEDGE_ENGINE.md        ← Umamusume and domain knowledge engine
├── MESSAGE_SYSTEM.md          ← Community message generation system
├── PROMPT_SYSTEM.md           ← Prompt building and template management
├── API_PROVIDER.md            ← Abstract multi-provider AI layer
├── SECURITY.md                ← Read-only enforcement and permission model
│
├── RAG_ENGINE.md              ← Retrieval-Augmented Generation pipeline
├── VECTOR_DATABASE.md         ← Vector storage and embedding schema
├── REPOSITORY_INDEXER.md      ← File scanning, chunking, and indexing
├── CONTENT_GENERATOR.md       ← Community content generation pipeline
├── TOPIC_FILTER.md            ← Scope enforcement and topic classification
├── CONTEXT_BUILDER.md         ← Context assembly for AI prompts
├── RESPONSE_VALIDATOR.md      ← Response quality and safety validation
│
├── CACHE.md                   ← Response and embedding cache
├── CONFIGURATION.md           ← Environment variables and runtime config
├── TESTING.md                 ← Test strategy and acceptance criteria
├── ROADMAP.md                 ← Phase roadmap and future features
├── EXAMPLES.md                ← Sample requests and responses
│
├── diagrams/
│   ├── Architecture.md        ← High-level system diagram
│   ├── AI Pipeline.md         ← Request-to-response pipeline diagram
│   ├── Repository Flow.md     ← Repository indexing flow diagram
│   ├── Sequence.md            ← Full sequence diagram
│   └── Message Flow.md        ← Message generation flow diagram
│
└── prompts/
    ├── Greeting.md            ← Daily greeting prompt template
    ├── Milestone.md           ← Milestone announcement prompt template
    ├── Achievement.md         ← Achievement unlock prompt template
    ├── Leaderboard.md         ← Leaderboard announcement prompt template
    ├── Warning.md             ← Fan deficit warning prompt template
    ├── Reminder.md            ← Event reminder prompt template
    └── Documentation.md       ← Documentation explanation prompt template
```

---

## Reading Order

For new contributors or implementers, read in this order:

1. `README.md` — this file
2. `ARCHITECTURE.md` — understand the full system design
3. `IMPLEMENTATION_PLAN.md` — understand the build phases
4. `SECURITY.md` — understand the permission model
5. `REPOSITORY_ENGINE.md` — understand how repository data is indexed
6. `RAG_ENGINE.md` — understand how retrieval works
7. `KNOWLEDGE_ENGINE.md` — understand Umamusume domain knowledge
8. `MESSAGE_SYSTEM.md` — understand message generation
9. `PROMPT_SYSTEM.md` — understand how prompts are assembled
10. `API_PROVIDER.md` — understand AI provider abstraction
11. Remaining component documents as needed

---

## Supported Commands

| Command | Description |
|---|---|
| `/ask <question>` | Ask any repository or Umamusume question |
| `/ai explain <topic>` | Get a structured explanation of a concept |
| `/ai search <query>` | Search the repository for relevant documents |
| `/ai docs <file>` | Get documentation for a specific file or department |
| `/ai glossary <term>` | Look up a term in the Umamusume glossary |
| `/ai message <type>` | Generate a community message of the specified type |

---

## Health Decisions

The AI Knowledge Service is supervised by the `Operation` health supervisor. It reports its own health state via `core/taskRegistry.js` like any other scheduled task.

---

## Related Documents

- `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` — supreme law
- `GOVERNANCE/PIPELINE_REGISTRY.md` — official department registry
- `GOVERNANCE/PIPELINE_OPERATIONS.md` — operational standards
- `AI/ARCHITECTURE.md` — complete system architecture
- `AI/SECURITY.md` — permission model and enforcement

---

## Version History

- `v1.0.0` — Initial AI Knowledge Service specification; full directory structure defined; read-only scope established; 21 root documents, 5 diagram documents, 7 prompt templates
