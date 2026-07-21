# Policy

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Project-level policies for data retention, access control, and privacy related to Vault, Depot, Archive, and all derived artifacts.

---

## Must Not

Policy violations that are **never** acceptable:

* Committing API keys, tokens, or secrets to the repository
* Logging full personal identifiers (Discord user IDs, trainer IDs) in high-frequency debug traces
* Storing Inspector-rejected data in Vault or Depot
* Deleting Archive records without an audit trail
* Bypassing the Vault adapter API for direct file or database access

---

## Storage Policy

| Component | Store | Retention | Notes |
|---|---|---|---|
| Vault | Inspector-approved trusted envelopes only | Configurable; default 90 days | Adapter determines durability |
| Depot | Compiler-produced compiled products only | Configurable; default 90 days | TTL-based expiry per product type |
| Archive | Archive-Inspector-approved notification records only | Configurable; default 90 days | Pruned by scheduled cleanup task |
| Broadcast history | Delivery attempt outcomes | 90 days | Append-only, never deleted during retention window |

---

## Access Control

* Only Inspector-approved data enters Vault — no direct writes from other departments
* Only Compiler-produced products enter Depot — no direct writes from other departments
* Only Archive-Inspector-approved records enter Archive — no direct writes from other departments
* Vault read access is limited to Refinery and authorized internal services
* Depot read access is limited to Workshop/Fabricator, Broadcast/Broker, and authorized internal services
* Archive read access is limited to Archive-Transporter, Announcer, and Broker (incomplete-record query only)

---

## Deletion Policy

```js
// Correct: use the adapter API
await vault.remove(id, { reason: 'user-request', auditBy: 'operator-id' });
await archive.prune({ olderThanDays: 90 });

// Wrong: never do this
fs.unlinkSync(path);       // direct file deletion
db.run('DELETE FROM ...');  // direct DB mutation outside adapter
```

All deletions must:
1. Go through the component's adapter API
2. Be logged with reason and operator identity
3. Respect applicable legal requirements (GDPR, etc.)

---

## Secret Management

* Rotate `UMA_MOE_API_KEY` on a scheduled basis
* Store secrets as environment variables — never in code or committed config files
* Mask `UMA_MOE_API_KEY` and Discord bot tokens in all log output

```js
// core/log.js — mask known secret patterns
function sanitize(msg) {
  return msg.replace(/([A-Za-z0-9_-]{24,})/g, (m) =>
    process.env.UMA_MOE_API_KEY && m === process.env.UMA_MOE_API_KEY ? '[REDACTED]' : m
  );
}
```

---

## Privacy

* If personal data is stored (Discord user IDs, trainer IDs), follow applicable laws
* Provide an erasure path: `vault.remove(id)` + `archive.deleteByUser(userId)`
* Do not log full trainer profiles at `INFO` level — use IDs and counts only

---

## See Also

- `umamoe/Vault/Vault.md` — Vault adapter contract and retention
- `Broadcast/Archive/Archive.md` — Archive schema and prune interface
- `GOVERNANCE/PIPELINE_OPERATIONS.md` — Operational procedures
