---
name: Qdrant payload indexes required
description: Newer Qdrant versions require payload indexes on any field used in scroll/filter queries, or they return 400 Bad Request.
---

## Rule
Always call `client.createPayloadIndex()` for every payload field used in a `filter` (scroll or search) immediately after ensuring the collection exists in `initialize()`. Do this unconditionally — it is idempotent and safe to call on existing collections.

**Why:** Qdrant (tested against @qdrant/js-client-rest 1.18.0 on Qdrant Cloud) returns `400 Bad Request: Index required but not found for "<field>" of one of the following types: [keyword]` when a scroll or filter references an unindexed payload field. Earlier versions allowed unindexed filters; this broke silently on upgrade.

**How to apply:**
In `QdrantBackend.initialize()`, after the `createCollection`/`already exists` block, run:
```js
const indexFields = [
  { name: 'filePath',   schema_type: 'keyword' },
  { name: 'department', schema_type: 'keyword' },
  { name: 'fileType',   schema_type: 'keyword' },
];
await Promise.all(indexFields.map(({ name, schema_type }) =>
  client.createPayloadIndex(collection, { field_name: name, field_schema: schema_type, wait: true })
    .catch(err => { if (!err?.message?.includes('already exists')) throw err; })
));
```

Also: `with_payload: ['fieldName']` (array) causes Bad Request in newer Qdrant — use `with_payload: { include: ['fieldName'] }` instead.
