# Contracts

Purpose
- Centralize the data contracts used across the Uma.moe pipeline: Miner envelopes, trusted envelopes, Vault results, and refinery artifacts.

Key contracts

1) Miner success envelope
{
  success: true,
  data: <raw API response>,
  metadata: { endpoint, source, statusCode, timestamp, attempts }
}

2) Miner failure envelope
{
  success: false,
  error: 'API_NOT_FOUND' | 'NETWORK_ERROR' | ...,
  message: string,
  retriable: boolean,
  context: { endpoint, statusCode }
}

3) Trusted envelope (Inspector -> Vault)
{
  trustedData: { id, ...normalized fields... },
  metadata: { source, endpoint, inspectedAt, storedAt }
}

4) Vault result
{ success: true, storedAt: 'ISO timestamp' } or an error result with code and message.

Usage notes
- Keep contracts small and stable. Prefer explicit fields over ad-hoc nested objects.
- Reference: umamoe/DATA_FORMAT.md and umamoe/Inspector/VALIDATION_RULES.md for normalization and validation details.
