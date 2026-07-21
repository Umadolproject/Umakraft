# Contracts

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Centralize the data contracts used across the UmaKraft pipeline: Miner envelopes, trusted envelopes, Vault results, Refinery artifacts, and Distribution handoff payloads.

All pipeline departments must produce and consume envelopes that match these contracts exactly.

---

## Must Not

Contracts must **never** be:

* Bypassed — departments must not pass raw ad-hoc objects where a defined contract applies
* Mutated in transit — envelopes are passed through unchanged until the stage responsible for transformation receives them
* Silently extended — adding fields to a contract requires updating this document

---

## Key Contracts

### 1. Miner Success Envelope

```json
{
  "success": true,
  "data": { },
  "metadata": {
    "endpoint": "/api/v4/user/profile/612856830731",
    "source": "https://uma.moe/api/v4/user/profile/612856830731",
    "statusCode": 200,
    "timestamp": "2026-07-21T10:00:00.000Z",
    "attempts": 1
  }
}
```

### 2. Miner Failure Envelope

```json
{
  "success": false,
  "error": "API_NOT_FOUND",
  "message": "Trainer not found",
  "retriable": false,
  "timestamp": "2026-07-21T10:00:00.000Z",
  "context": {
    "endpoint": "/api/v4/user/profile/invalid-id",
    "statusCode": 404
  }
}
```

Error codes: `API_NOT_FOUND` | `API_RATE_LIMIT_EXCEEDED` | `NETWORK_TIMEOUT` | `NETWORK_CONNECTION_REFUSED` | `API_INTERNAL_ERROR` | `API_UNAUTHORIZED` | `API_BAD_REQUEST`

### 3. Trusted Envelope (Inspector → Vault)

```json
{
  "trustedData": {
    "id": "612856830731",
    "name": "Alice",
    "fans": 150000000,
    "rank": 45
  },
  "metadata": {
    "source": "https://uma.moe/api/v4/user/profile/612856830731",
    "endpoint": "/api/v4/user/profile/612856830731",
    "inspectedAt": "2026-07-21T10:00:01.000Z",
    "storedAt": "2026-07-21T10:00:01.500Z"
  }
}
```

### 4. Vault Result

```json
{ "success": true, "storedAt": "2026-07-21T10:00:01.500Z" }
```

Failure:
```json
{ "success": false, "error": "DEPOT_PERSISTENCE_FAILURE", "message": "...", "retriable": true }
```

### 5. Refined Result Envelope (Refiner → Compiler)

```json
{
  "refinedResult": {
    "id": "612856830731",
    "fans": 150000000,
    "dailyGain": 12000
  },
  "metadata": {
    "refinedAt": "2026-07-21T10:01:00.000Z",
    "refinerVersion": "v1.0"
  }
}
```

### 6. Compiled Product (Compiler → Depot)

```json
{
  "compiledProduct": {
    "id": "612856830731",
    "version": "2026-07-21T10:02:00.000Z",
    "profile": { },
    "stats": { "fans": 150000000, "dailyGain": 12000 },
    "presentationHints": { "highlight": "dailyGain" }
  },
  "provenance": {
    "sources": [
      { "refiner": "refiner-profile", "refinedAt": "2026-07-21T10:01:00.000Z" }
    ],
    "compiledAt": "2026-07-21T10:02:00.000Z",
    "compilerVersion": "v2.0"
  }
}
```

### 7. Workshop Deliverable (Terminal → Distribution)

```json
{
  "deliverableId": "uuid-abc123",
  "type": "fanGainCard",
  "approvedAt": "2026-07-21T10:03:00.000Z",
  "payload": {
    "embed": { },
    "attachment": "<Buffer>"
  },
  "releaseMetadata": {
    "blueprintVersion": "v1.2",
    "fabricatorVersion": "v1.0"
  }
}
```

---

## Usage Notes

- Keep contracts small and stable. Prefer explicit fields over ad-hoc nested objects.
- Reference `umamoe/DATA_FORMAT.md` for Trainer object schema.
- Reference `umamoe/Inspector/VALIDATION_RULES.md` for field validation rules.
- Reference `umamoe/ERROR_HANDLING.md` for error envelope semantics.
