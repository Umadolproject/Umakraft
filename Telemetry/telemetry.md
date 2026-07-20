# Telemetry

Purpose
- Describe logging, metrics, and tracing approaches used across the pipeline for observability.

Guidelines
- Use structured logs (JSON) where possible with fields: timestamp, component, level, message, context.
- Key env toggles in repo:
  - UMA_MOE_VERBOSE / DEBUG_MINER — miner verbose logs
  - process.env.NODE_ENV — use to reduce noise in production

What to capture
- Miner: endpoint, statusCode, attempts, duration
- Courier: transport duration, endpoint, result
- Inspector: validation pass/fail reason
- Vault: store/get/update/delete results and errors
- Refinery: processed count and artifacts path

Integration
- Emit metrics (counters/histograms) for request rates, failures, and latencies
- Optionally integrate with Prometheus/statsd and centralized logging (e.g., ELK)

Privacy
- Do not log sensitive keys (mask UMA_MOE_API_KEY) or full personal identifiers in high-frequency traces.

If desired, implement a small telemetry helper that wraps console.log and emits structured JSON.
