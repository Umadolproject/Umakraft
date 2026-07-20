# Telemetry

**Monitoring, Logging & Observability**

This folder contains logging, metrics, and monitoring infrastructure.

## Purpose

Provides:
- Structured logging
- Metrics collection
- Health checks
- Performance monitoring
- Audit trails

## Principle

Every pipeline operation should be observable. Telemetry helps detect architectural violations.

## See Also

- `GOVERNANCE/PIPELINE_OPERATIONS.md` — Logging standards and health states
- `core/log.js` — Logging interface
- `core/health.js` — Health endpoint
