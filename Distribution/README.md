# Distribution

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v1.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

**STAGE 4: Coordinate User-Facing Application Flow**

## Purpose

Receive user commands, orchestrate pipeline execution, and deliver results to Discord.

Distribution is the customer-service stage of the pipeline — the only stage that faces the user directly. It receives every slash command, coordinates the work required to fulfill it, and returns the result.

---

## Departments

| Department | Role | Analogy |
|------------|------|---------|
| **Commands** | Receives slash commands, validates input, routes to Coordinator | Front desk |
| **Coordinator** | Orchestrates pipeline stages per command, retrieves finished deliverables | Case manager |
| **Dispatcher** | Delivers finished deliverables to the correct Discord destination | Delivery clerk |

---

## Pipeline Position

```text
Workshop / Terminal
        │
        ▼
   Distribution
  ┌─────────────────────────────┐
  │  Commands                   │
  │     ↓                       │
  │  Coordinator                │
  │     ↓                       │
  │  Dispatcher                 │
  └─────────────────────────────┘
        │
        ▼
     Broadcast
```

---

## Department Docs

- `Commands/Commands.md` — Front desk; command intake and validation
- `Coordinator/Coordinator.md` — Case manager; pipeline orchestration
- `Dispatcher/Dispatcher.md` — Delivery clerk; Discord response delivery

---

## Ownership Rules

- **Commands** is the sole entry point for all Discord slash command events.
- **Coordinator** is the sole department that calls upstream pipeline stages (Umamoe, Refinery, Workshop).
- **Dispatcher** is the sole department that delivers responses outward to Discord.

No department may assume another's responsibility.

---

## See Also

- `GOVERNANCE/PIPELINE_REGISTRY.md` — Distribution stage specification
- `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` — Constitutional authority
- `GOVERNANCE/PIPELINE_OPERATIONS.md` — Operational procedures
