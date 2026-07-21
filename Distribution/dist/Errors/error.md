# Errors

Purpose
- Centralize error classifications used across the Uma.moe pipeline and give guidance for handling and logging.

Classification
- NETWORK_* — transient network issues (retriable)
- API_* — API-specific errors (400/401/403/404) (often non-retriable)
- MINER_* — miner-level errors (invalid input, endpoint not approved)
- TRANSPORT_* — courier/delivery errors
- VAULT_* — storage errors
- REFINE_* — refinery processing errors

Guidance
- Include original error.message in logs and in error.context when returning envelope
- Mark retriable=true for transient errors to enable caller backoff
- Use severity: info|warning|critical to guide incident response

Reference: umamoe/ERROR_HANDLING.md for project-specific error shapes and examples.
