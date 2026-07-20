# Broadcast

**STAGE 5: Deliver Notifications**

## Purpose

Manage notification lifecycle from trigger through delivery.

## Departments

| Department | Purpose |
|------------|----------|
| **Broker** | Notification entry point; scheduled triggers |
| **Inspector** | Notification approval authority; eligibility check |
| **Archive** | Persistent notification storage |
| **Announcer** | Discord delivery |

## Pipeline Flow

```
Trigger → Broker → Inspector → Archive → Announcer → Delivery
```

## Status

**IN PROGRESS** (v0.9.0 - 1.0.0)

Assimilating pending modules from fantracking/ and tasks/

## See Also

- `GOVERNANCE/PIPELINE_REGISTRY.md` — Broadcast stage specification
- `GOVERNANCE/PIPELINE_EVOLUTION.md` — Assimilation backlog
