// core/pipelineRuntime.js
// Source-of-truth runtime settings for pipeline operations.
// Phase 4: added stage timeouts, broker concurrency, and vault snapshot retention.

const envInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const pipelineRuntime = {
  // ── Broadcast delivery ────────────────────────────────────────────────────
  broadcastMaxDeliveryAttempts:    envInt('BROADCAST_MAX_DELIVERY_ATTEMPTS', 5),
  broadcastRecoveryBatchSize:      envInt('BROADCAST_RECOVERY_BATCH_SIZE', 100),
  broadcastDeadLetterInspectLimit: envInt('BROADCAST_DEADLETTER_INSPECT_LIMIT', 10),

  // ── Broker concurrency (Phase 4) ─────────────────────────────────────────
  // Max number of circles processed in parallel during a Broker run.
  // Set to 1 to restore sequential behaviour.
  brokerConcurrency: envInt('BROKER_CONCURRENCY', 3),

  // ── Stage timeouts (Phase 4) ─────────────────────────────────────────────
  // Maximum ms any single pipeline stage is allowed to run. 0 = disabled.
  stageTimeoutMs:      envInt('PIPELINE_STAGE_TIMEOUT_MS', 30_000),
  // Override for Miner (web scraping — give it more room).
  minerTimeoutMs:      envInt('PIPELINE_MINER_TIMEOUT_MS', 45_000),
  // Override for Fabricator (Puppeteer rendering can be slow).
  fabricatorTimeoutMs: envInt('PIPELINE_FABRICATOR_TIMEOUT_MS', 90_000),

  // ── Vault snapshot retention (Phase 4) ───────────────────────────────────
  // Max snapshots kept per trainer ID in vault_snapshots.
  // Older snapshots beyond this limit are pruned after each write.
  vaultSnapshotRetainCount: envInt('VAULT_SNAPSHOT_RETAIN_COUNT', 20),
};

/**
 * Resolve the timeout for a named stage, honouring per-stage overrides.
 *
 * @param {string} stageName
 * @returns {number} timeout in ms (0 = disabled)
 */
export function stageTimeout(stageName) {
  const lower = stageName?.toLowerCase() ?? '';
  if (lower === 'miner') return pipelineRuntime.minerTimeoutMs;
  if (lower === 'fabricator') return pipelineRuntime.fabricatorTimeoutMs;
  return pipelineRuntime.stageTimeoutMs;
}
