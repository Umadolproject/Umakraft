# Policy

Purpose
- Project-level policies for data retention, access, and privacy related to Vault and derived artifacts.

Key rules
- Storage: Trusted envelopes in Vault are persisted per adapter retention policies. Default in-memory adapter is ephemeral.
- Retention: Implementers should support configurable retention windows; recommend 90 days for non-critical artifacts unless otherwise required.
- Access: Only Inspector-approved data enters Vault. Access to Vault data should be limited to internal services and authorized operators.
- Deletion: use Vault.remove(id) with proper audit trail; do not rely on accidental file deletion.

Notes
- Security: Rotate API keys (UMA_MOE_API_KEY) and avoid committing secrets.
- Compliance: If personal data is included, follow applicable laws (e.g., GDPR) and add consent/erasure flows.
