// core/pipelineRuntime.js
// Source-of-truth runtime settings for pipeline operations.

const envInt = (name, fallback) => {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const pipelineRuntime = {
  broadcastMaxDeliveryAttempts: envInt('BROADCAST_MAX_DELIVERY_ATTEMPTS', 5),
  broadcastRecoveryBatchSize: envInt('BROADCAST_RECOVERY_BATCH_SIZE', 100),
  broadcastDeadLetterInspectLimit: envInt('BROADCAST_DEADLETTER_INSPECT_LIMIT', 10),
};
