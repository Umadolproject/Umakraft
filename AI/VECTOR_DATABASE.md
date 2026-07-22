# Vector Database

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Department:** Knowledge
**Status:** ACTIVE
**Version:** 1.0.0
**Last Updated:** 2026-07-22

---

## Purpose

The Vector Database stores the embedding vectors and metadata for every indexed document chunk in the repository. It is the persistence layer for the RAG Engine's similarity search. At query time it receives a query vector and returns the top-k most similar stored chunks.

---

## Scope

| In Scope | Out of Scope |
|---|---|
| Storing chunk embeddings and metadata | Generating embeddings (API Provider) |
| Cosine similarity search | Document chunking (Repository Indexer) |
| Metadata-filtered search | Prompt assembly |
| Embedding update on re-index | Delivering responses to Discord |
| Deletion of stale embeddings | |
| Backup and restore | |

---

## Responsibilities

- Accept chunk embeddings from the Repository Indexer and store them with metadata
- Perform fast similarity search for the RAG Engine
- Support metadata filtering (department, file type, scope)
- Track indexing timestamps and checksums for incremental update detection
- Delete embeddings for files that have been removed from the repository
- Provide backup and restore for the full embedding store

---

## Architecture

```mermaid
flowchart LR
    RI[Repository Indexer] -->|upsert| VDB[(Vector Database)]
    RAG[RAG Engine] -->|similarity search| VDB
    VDB -->|top-k chunks| RAG
    SCHED[Index Scheduler] -->|checksum check| VDB
    VDB -->|stale embeddings| DEL[Delete Stale]
```

---

## Embedding Schema

Each stored embedding record:

```js
{
  id: string,               // SHA-256 of (filePath + chunkIndex)
  vector: Float32Array,     // embedding vector (e.g. 1536 dimensions for text-embedding-3-small)
  filePath: string,         // e.g. "umamoe/Vault/vault.js"
  chunkIndex: number,       // position of this chunk within the file
  heading: string | null,   // nearest heading above this chunk
  department: string,       // e.g. "Umamoe"
  fileType: string,         // e.g. "JavaScript"
  content: string,          // raw chunk text (stored for citation display)
  tokenCount: number,       // estimated token count of this chunk
  checksum: string,         // SHA-256 of the source file at indexing time
  indexedAt: Date           // when this embedding was created or updated
}
```

---

## Indexing Frequency

| Trigger | Description |
|---|---|
| Startup | Full index run if the vector database is empty |
| Scheduled | Incremental index every 6 hours (configurable via `VDB_INDEX_INTERVAL_HOURS`) |
| Manual | `/ai reindex` command (admin only) |
| Checksum change | Any file whose checksum differs from the stored value is re-indexed automatically |

---

## Similarity Search

### Method

Cosine similarity between the query vector and all stored vectors.

### Performance

For repositories up to ~10,000 chunks, an in-memory flat index (brute-force search) provides sub-millisecond retrieval. For larger repositories, an approximate nearest neighbour (ANN) index (e.g. HNSW) is recommended.

### Search Parameters

```js
{
  queryVector: Float32Array,
  topK: number,           // default 8
  minScore: number,       // default 0.60
  filter: {
    department?: string,
    fileType?: string,
    scope?: string
  }
}
```

---

## Update Policy

| Event | Action |
|---|---|
| New file added | Full index of new file; insert new embeddings |
| File modified | Re-index file; upsert all chunks (delete old, insert new) |
| File deleted | Delete all embeddings for that file path |
| Heading changed within file | Re-index file; update heading metadata for affected chunks |

Upsert is identified by the chunk `id` (SHA-256 of filePath + chunkIndex).

---

## Deletion Policy

Stale embeddings are deleted when:
- The source file no longer exists in the repository
- The source file has been excluded by a new exclusion rule
- A manual `/ai reindex --clean` command is issued (admin only)

Deletion is always logged at `info` level via `core/log.js`.

---

## Cache Integration

The Vector Database integrates with the Cache layer:

- Recently queried vectors are kept in a hot cache for sub-millisecond repeated lookup
- Cache TTL: 10 minutes (configurable via `VDB_QUERY_CACHE_TTL_MS`)
- The cache is keyed by the query vector hash, not the raw query text

---

## Backup and Restore

### Backup

```text
VDB_BACKUP_PATH=/data/vdb_backup
VDB_BACKUP_SCHEDULE=0 2 * * *   (daily at 02:00)
```

Backup format: JSON export of all embedding records (vectors serialised as base64).

### Restore

```bash
# Restore from a backup file
node AI/tools/vdb-restore.js --file /data/vdb_backup/2026-07-22.json
```

Restore replaces the entire vector store and triggers a checksum validation pass.

---

## Configuration

```text
VDB_BACKEND=memory              # 'memory' | 'sqlite' | 'qdrant' | 'pinecone'
VDB_EMBEDDING_DIM=1536          # must match the embedding model dimension
VDB_TOP_K=8
VDB_MIN_SCORE=0.60
VDB_INDEX_INTERVAL_HOURS=6
VDB_QUERY_CACHE_TTL_MS=600000
VDB_BACKUP_PATH=/data/vdb_backup
```

---

## Best Practices

- Always verify that the embedding dimension in the database matches the currently configured embedding model before querying
- Log every upsert and delete event for audit trails
- Never expose raw embedding vectors in API responses or logs
- Run a checksum validation pass after every restore
- Prefer `upsert` over `delete + insert` to avoid search gaps during re-indexing

---

## Future Expansion

- HNSW approximate nearest neighbour index for repositories with >10,000 chunks
- Multi-modal embeddings for code and documentation in separate vector spaces
- Per-department vector namespaces for isolated search
- Cross-repository search (future multi-repo support)
- Embedding drift detection — re-index when the embedding model is upgraded

---

## Related Documents

- `AI/REPOSITORY_INDEXER.md` — produces the chunks stored here
- `AI/RAG_ENGINE.md` — queries this database for retrieval
- `AI/CACHE.md` — query result caching layer
- `AI/CONFIGURATION.md` — VDB environment variables
- `AI/diagrams/Repository Flow.md` — visual indexing and retrieval flow

---

## Version History

- `v1.0.0` — Initial Vector Database specification; embedding schema; similarity search; update and deletion policy; backup and restore; cache integration; configuration variables
