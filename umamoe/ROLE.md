# Uma.moe Roles (ROLE.md)

Purpose
- Describe the responsibilities, inputs, outputs, and boundaries of each core Uma.moe pipeline role so stakeholders and contributors share a single source of truth.

Roles

1. Miner
- Responsibility: Acquire external data from uma.moe (API and CDN). Handle retries, timeouts, backoff, and rate-limiting.
- Input: { endpoint, pathParams?, queryParams?, requestBody? }
- Output: Standardized envelope: either Success { success: true, data, metadata } or Failure { success: false, error, message, retriable, context }
- Constraints: Only call APPROVED endpoints; avoid uncontrolled scraping; tag metadata.source with the full URL.

2. Courier
- Responsibility: Transport Miner envelopes safely to the Inspector. Validate transportability and perform delivery retries/observability.
- Input: Miner envelope
- Output: Inspector result or passthrough miner failure
- Constraints: Do not inspect or modify data content; only validate transport fields.

3. Inspector
- Responsibility: Validate payloads according to VALIDATION_RULES.md (existence, structure, completeness, type integrity, range integrity). Construct a trusted envelope for accepted data.
- Input: Miner envelope (passed through Courier)
- Output: { passed: true, vaultResult } or { passed: false, reason }
- Constraints: Gatekeeper only — do not persist without Vault API, must attach inspectedAt metadata.

4. Vault
- Responsibility: Persist trusted envelopes. Provide retrieval, query, update, and delete APIs. Preserve metadata and integrity.
- Input: Trusted envelope from Inspector
- Output: Storage result { success:true, storedAt } or error envelopes
- Constraints: Implement adapter pattern (in-memory, file, DB). Do not re-validate input.

5. Refinery
- Responsibility: Consume trusted data from Vault, produce derived artifacts and lightweight summaries for downstream consumers.
- Input: Trusted envelope(s)
- Output: Refined artifacts (JSON files, summaries) and success metadata
- Constraints: Refinery may transform/aggregate but must record provenance (source + inspectedAt)

Operational rules
- Error handling: Classify errors into retriable and non-retriable. Preserve original errors in context for diagnostics.
- Metadata: Every envelope must include metadata.source, metadata.endpoint, metadata.statusCode, and timestamps (timestamp, inspectedAt, storedAt).
- Auditing: All cross-boundary deliveries (Miner→Courier, Courier→Inspector, Inspector→Vault) must log an opaque envelope id and short context.
- Rate-limits & politeness: Use umaQueue for global spacing and respect UMA API rate policies.

Examples
- Miner call: { endpoint: '/v4/user/profile/{account_id}', pathParams: { account_id: '612856830731' } }
- Success envelope: { success:true, data: {...}, metadata:{ endpoint:'/v4/user/profile/612856830731', source:'https://uma.moe/api/v4/user/profile/612856830731', statusCode:200, timestamp:'2026-07-19T...' } }
- Trusted envelope to Vault: { trustedData: {...normalized...}, metadata:{ source:..., inspectedAt:'...' } }

Open questions / extension points
- Authorization model for who can write to Vault (ACLs) — currently implicit/trusted by Inspector.
- Long-term storage: recommended adapters (SQLite/JSONL/S3) and retention policy.

If you want, expand any role's section with code examples, CLI commands, or unit-test scaffolds. Which role should be detailed next?