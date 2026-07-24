# Repository Engine

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

The Repository Engine is the component responsible for giving the AI read-only understanding of the entire Umakraft repository. It orchestrates the Repository Indexer, Vector Database, and RAG Engine into a unified interface for repository search and retrieval.

---

## Scope

| In Scope | Out of Scope |
|---|---|
| Scan and index all repository files | Modifying any file |
| Read Markdown, JavaScript, JSON, YAML | Writing to databases |
| Read governance documents | Executing scripts |
| Read blueprints and configuration docs | Committing changes |
| Build searchable knowledge from repository | Accessing secrets |
| Answer repository questions with citations | Answering Umamusume questions (handled by Knowledge Engine) |

---

## Responsibilities

- Scan the full repository on startup and on a configurable schedule
- Classify documents by type and department
- Chunk documents into retrieval-ready segments
- Build and maintain the vector index
- Answer repository search queries with source citations
- Never modify any repository file, even for indexing metadata

---

## Directory Coverage

All directories in the repository are indexed:

```text
/
├── AI/                     ← AI subsystem documentation
├── Broadcast/              ← Stage 5 — delivery pipeline
├── core/                   ← Shared infrastructure
├── Distribution/           ← Stage 4 — Discord interface
├── GOVERNANCE/             ← Architecture authority documents
├── INFRASTRUCTURE/         ← Adapters, contracts, telemetry
├── Operation/              ← Health supervisor
├── Refinery/               ← Stage 2 — data transformation
├── tasks/                  ← Task scheduler
├── umamoe/                 ← Stage 1 — data acquisition
└── Workshop/               ← Stage 3 — rendering
```

### Exclusion Rules

The following are excluded from indexing:

```text
node_modules/
.git/
.local/
attached_assets/
*.log
*.env
*.lock
dist/
coverage/
```

---

## Architecture

```mermaid
flowchart LR
    R[Repository Files] --> RI[Repository Indexer]
    RI --> DC[Document Classifier]
    DC --> CB[Chunk Builder]
    CB --> EQ[Embedding Queue]
    EQ --> VDB[Vector Database]
    VDB --> SS[Semantic Search]
    SS --> RE[Repository Engine]
    RE --> CTX[Context Builder]
```

---

## Workflow

### Indexing Workflow

1. Repository Indexer scans all non-excluded directories recursively
2. Each file is classified by type (Markdown, JavaScript, JSON, etc.) and department
3. Files are split into chunks of 500–1200 characters with heading context preserved
4. Each chunk is embedded via the API Provider's embedding model
5. Embeddings are stored in the Vector Database with metadata
6. A checksum is stored per file to enable incremental re-indexing

### Search Workflow

1. A user query arrives at the Repository Engine
2. The query is embedded using the same embedding model used during indexing
3. The Vector Database performs a similarity search and returns the top-k chunks
4. Chunks are ranked by relevance score
5. The Context Builder receives the ranked chunks
6. Source citations (file path + section heading) are attached to each chunk

---

## Technical Design

### Document Types

| Type | Extensions | Indexing Strategy |
|---|---|---|
| Markdown | `.md` | Full content; headings used as chunk boundaries |
| JavaScript | `.js` | Comments, JSDoc, function signatures |
| JSON | `.json` | Keys and values; structure-aware chunking |
| YAML | `.yaml`, `.yml` | Keys and values |
| SQL | `.sql` | Statement-level chunking |
| Plain text | `.txt` | Paragraph-level chunking |

### Chunk Strategy

```text
Target chunk size: 500–1200 characters
Overlap: 100 characters between adjacent chunks
Boundary: Prefer heading or paragraph boundaries
```

### Chunk Metadata

Each chunk carries:

```text
{
  filePath: string,       // e.g. "umamoe/Miner/miner.js"
  heading: string | null, // nearest heading above the chunk
  department: string,     // e.g. "Umamoe", "Broadcast", "AI"
  fileType: string,       // e.g. "JavaScript", "Markdown"
  indexedAt: Date,        // when this chunk was last indexed
  checksum: string        // SHA-256 of the source file
}
```

### Search Modes

| Mode | Description | Example |
|---|---|---|
| Semantic | Embedding similarity search | "how does fan gain work" |
| Exact filename | Direct file lookup by path | "umamoe/Miner/miner.js" |
| Blueprint search | Scoped to Workshop blueprints | "fanGain blueprint" |
| Governance search | Scoped to GOVERNANCE/ documents | "Article XII" |
| Command search | Scoped to Distribution/Commands | "/fanGain command" |
| Folder search | Scoped to a specific directory | "Broadcast department" |

---

## Source Citation Format

Every answer generated using repository content must include citations:

```text
Sources:
- umamoe/Miner/miner.js — Miner (data acquisition)
- GOVERNANCE/ARCHITECTURE_AUTHORITY.md — Article IV (Pipeline Integrity)

Confidence: 91% — Repository Source Code + Documentation
```

---

## Examples

### Repository Question

**Input:** "How does the Vault store data?"

**Repository Engine retrieves:**
- `umamoe/Vault/vault.js` — `receive()` and `retrieve()` functions
- `INFRASTRUCTURE/Contracts/contract.md` — Vault result contract

**Response includes:**
- Explanation of the adapter pattern
- Description of the trusted envelope requirement
- Source citations

---

## Best Practices

- Always embed queries with the same model used for indexing
- Never truncate chunk metadata — citations require file path and heading
- Re-index files whose checksum has changed, not the entire repository
- Log all indexing errors without failing the entire indexing run
- Return at least 3 and at most 8 chunks per query to balance context quality and token budget

---

## Future Expansion

- Incremental indexing triggered by file change events
- Git diff awareness — detect and re-index only changed files
- Broken link detection — identify references to files that no longer exist
- Duplicate document detection — flag near-identical documentation
- Repository health report — summary of documentation coverage per department

---

## Related Documents

- `AI/ARCHITECTURE.md` — full system architecture
- `AI/REPOSITORY_INDEXER.md` — indexing pipeline detail
- `AI/VECTOR_DATABASE.md` — embedding storage and similarity search
- `AI/RAG_ENGINE.md` — retrieval-augmented generation pipeline
- `AI/CONTEXT_BUILDER.md` — context assembly for prompts
- `AI/diagrams/Repository Flow.md` — visual repository flow diagram

---

## Version History

- `v1.0.0` — Initial Repository Engine specification; full directory coverage; six search modes; chunk strategy; source citation format; metadata schema
- `v1.1.0` — Fixed chunk metadata field `lastIndexed` → `indexedAt` to match Repository Indexer spec and Vector Database embedding schema
- `v1.2.0` — Added `.local/` to exclusion rules to match Repository Indexer exclusion list
