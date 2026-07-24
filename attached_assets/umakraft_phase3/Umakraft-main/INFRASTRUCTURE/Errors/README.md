# Errors

**Error Handling & Definitions**

This folder contains centralized error handling and error type definitions.

## Purpose

Provides:
- Error classes and types
- Error classification
- Error routing logic
- Retry utilities
- Safe execution wrappers

## Principle

All pipeline errors flow through this layer. Errors are classified by ownership per `GOVERNANCE/PIPELINE_OPERATIONS.md`.

## Example

```javascript
// safeRun: Execute with automatic error handling
const result = await safeRun(() => miner.fetch());

// withRetry: Retry with exponential backoff
const result = await withRetry(async () => {
  return await vault.store(data);
});
```
