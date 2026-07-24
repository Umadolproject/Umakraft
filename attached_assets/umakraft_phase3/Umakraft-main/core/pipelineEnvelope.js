// core/pipelineEnvelope.js
// Shared helpers for success/failure envelopes across pipeline boundaries.

export function successEnvelope(stage, payload = {}, context = {}) {
  return {
    success: true,
    stage,
    timestamp: new Date().toISOString(),
    ...payload,
    context,
  };
}

export function failureEnvelope(stage, error, message, context = {}, retriable = false) {
  return {
    success: false,
    failedAt: stage,
    error,
    message,
    retriable,
    timestamp: new Date().toISOString(),
    context,
  };
}
