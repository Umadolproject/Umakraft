# Adapters

**Interface Adapters & Connectors**

This folder contains adapter implementations that allow different subsystems to communicate across architectural boundaries.

## Purpose

Adapters translate between different interfaces without modifying the core pipeline logic. They enable pipeline stages to connect to external systems or alternative implementations.

## Principle

Adapters are support infrastructure. They serve pipeline departments but do not replace them.

## Examples

- Storage adapters (SQLite, in-memory, file-based)
- Transport adapters (HTTP, message queue, streaming)
- Format converters (JSON, Protocol Buffers, CSV)
- Client adapters (Discord, REST, gRPC)

## See Also

- `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` Article X — Supporting Modules
