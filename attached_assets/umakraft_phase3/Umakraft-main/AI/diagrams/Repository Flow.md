# Repository Flow Diagram

**Department:** Knowledge — AI
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Repository Indexing Flow

```mermaid
flowchart TD
    SCHED([Scheduler / Startup]) --> SCAN[Directory Scanner]

    SCAN --> EX{Excluded?}
    EX -->|yes| SKIP([Skip File])
    EX -->|no| CHK[Checksum Checker]

    CHK --> CHG{Changed?}
    CHG -->|no| SKIP2([Skip — Unchanged])
    CHG -->|yes| CLASS[Document Classifier]

    CLASS --> CHUNK[Chunk Builder]
    CHUNK --> Q[Embedding Queue]
    Q --> AP[API Provider embed]
    AP --> VDB[(Vector Database upsert)]

    SCAN --> DEL{File Deleted?}
    DEL -->|yes| VDBD[Vector Database delete]

    style SKIP fill:#adb5bd,color:#fff
    style SKIP2 fill:#adb5bd,color:#fff
    style VDB fill:#339af0,color:#fff
    style VDBD fill:#ff6b6b,color:#fff
```

---

## Repository Query Flow

```mermaid
flowchart LR
    Q([User Query]) --> EMB[Embed Query]
    EMB --> SIM[Cosine Similarity Search]
    SIM --> VDB[(Vector Database)]
    VDB --> RES[Top-k Results]
    RES --> MF[Metadata Filter]
    MF --> RNK[Rank by Score]
    RNK --> TB[Token Budget Check]
    TB --> CB[Context Builder]
    CB --> OUT([Context Block → Prompt System])

    style VDB fill:#339af0,color:#fff
    style OUT fill:#51cf66,color:#fff
```

---

## Indexing Schedule

| Trigger | Type | Description |
|---|---|---|
| Startup (empty VDB) | Full | Index all non-excluded files |
| Startup (VDB populated) | Incremental | Re-index only changed files |
| Every 6 hours | Incremental | Checksum diff scan |
| `/ai reindex` (admin) | Full | Force complete re-index |
| `/ai reindex --clean` (admin) | Clean + Full | Delete all, then full re-index |

---

## Chunk Boundaries

```text
Priority 1: ## or ### heading boundaries (Markdown)
Priority 2: Function/class boundary (JavaScript)
Priority 3: Paragraph boundary (blank line)
Priority 4: Sentence boundary (period + space)
Fallback:   Hard cut at 1200 characters
```

---

## Related Documents

- `AI/REPOSITORY_ENGINE.md` — orchestrates this flow
- `AI/REPOSITORY_INDEXER.md` — indexing pipeline detail
- `AI/RAG_ENGINE.md` — query retrieval pipeline
- `AI/VECTOR_DATABASE.md` — storage layer
