# Architecture Diagram

**Department:** Knowledge — AI
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Full System Architecture

```mermaid
flowchart TD
    subgraph DISCORD["Discord Layer"]
        U[Discord User]
        GW[AI Command Gateway]
        OUT[Discord Response]
    end

    subgraph FILTER["Scope Layer"]
        TF[Topic Filter]
    end

    subgraph INTEL["Intelligence Layer"]
        RE[Repository Engine]
        KE[Knowledge Engine]
        CG[Content Generator]
        REJ[Off-topic Rejection]
    end

    subgraph RETRIEVAL["Retrieval Layer"]
        RI[Repository Indexer]
        VDB[(Vector Database)]
        RAG[RAG Engine]
        CB[Context Builder]
    end

    subgraph GENERATION["Generation Layer"]
        PS[Prompt System]
        AP[API Provider]
        CA[Cache]
    end

    subgraph VALIDATION["Validation Layer"]
        RV[Response Validator]
    end

    U --> GW
    GW --> TF

    TF -->|repository| RE
    TF -->|umamusume| KE
    TF -->|message| CG
    TF -->|off-topic| REJ

    RE --> RI
    RE --> RAG
    RAG --> VDB
    RI --> VDB

    RAG --> CB
    KE --> CB
    CG --> PS

    CB --> PS
    PS --> AP
    AP <--> CA

    AP --> RV
    RV --> OUT
    REJ --> OUT

    style REJ fill:#ff6b6b,color:#fff
    style OUT fill:#51cf66,color:#fff
    style VDB fill:#339af0,color:#fff
```

---

## Layer Descriptions

| Layer | Components | Purpose |
|---|---|---|
| Discord Layer | Command Gateway, Discord Response | User-facing input/output |
| Scope Layer | Topic Filter | Request classification and routing |
| Intelligence Layer | Repository Engine, Knowledge Engine, Content Generator | Domain-specific request handling |
| Retrieval Layer | Indexer, Vector DB, RAG Engine, Context Builder | Repository content retrieval |
| Generation Layer | Prompt System, API Provider, Cache | AI text generation |
| Validation Layer | Response Validator | Quality and safety enforcement |

---

## Component Count

| Layer | Count |
|---|---|
| Discord Layer | 2 |
| Scope Layer | 1 |
| Intelligence Layer | 4 (including rejection) |
| Retrieval Layer | 4 |
| Generation Layer | 3 |
| Validation Layer | 1 |
| **Total** | **15** |

---

## Related Documents

- `AI/ARCHITECTURE.md` — full architecture prose
- `AI/diagrams/AI Pipeline.md` — request-to-response pipeline
- `AI/diagrams/Repository Flow.md` — repository indexing flow
- `AI/diagrams/Sequence.md` — full sequence diagram
- `AI/diagrams/Message Flow.md` — message generation flow
