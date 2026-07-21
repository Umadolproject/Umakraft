# Adapters

Purpose
- Define the storage adapter contract used by Vault and other persistence consumers (Refinery, backups).
- Adapters decouple storage implementation (in-memory, file, DB, S3) from Vault and allow swapping backends.

Contract (JS interface)
- async store(envelope) => { success: boolean, storedAt?: string, error?: string }
- async getById(id) => envelope|null
- async query(criteria) => envelope[]
- async update(id, patch) => { success: boolean, storedAt?: string }
- async remove(id, options) => { success: boolean, deleted?: number }

Error semantics
- Adapters should throw only on unexpected internal failures. When possible return structured error objects as the function result (e.g., { success:false, error:'NOT_FOUND' }).
- Preserve original error details in logs and include them in returned error.context for diagnostics.

Examples
- In-memory adapter (used for tests): umamoe/Vault/adapters/inmemory.js — stores envelopes in a Map and implements query/update/remove semantics.

- Minimal file adapter sketch (recommended):

```js
// adapters/file.js
import fs from 'node:fs/promises';
import path from 'node:path';

export default function createFileAdapter(baseDir){
  return {
    async store(envelope){
      const id = envelope.trustedData.id;
      const ts = (envelope.metadata && envelope.metadata.storedAt) || new Date().toISOString();
      const file = path.join(baseDir, `${id}:${ts}.json`);
      await fs.mkdir(baseDir, { recursive: true });
      await fs.writeFile(file, JSON.stringify(envelope, null, 2), 'utf8');
      return { success: true, storedAt: ts };
    },
    async getById(id){ /* read latest file for id */ },
    async query(criteria){ /* list files, parse, filter */ },
    async update(id, patch){ /* read, merge, write new version */ },
    async remove(id, options){ /* delete files matching id */ }
  };
}
```

Implementation notes
- Preserve envelope.metadata exactly; do not alter inspectedAt/storedAt unless performing intentional updates.
- Provide consistent timestamp formatting (ISO 8601) for storedAt.
- Keep adapters idempotent where possible (store should not clobber previous versions unless explicitly requested).
- Tests should use the in-memory adapter.

Security & privacy
- When writing to file or external services, redact secrets from logs.
- Follow the project's data retention and privacy policy when implementing delete/retention semantics.

If you want, I can now:
- Implement a file-backed adapter at umamoe/Vault/adapters/file.js, or
- Expand the adapter docs with examples for S3/SQLite adapters.