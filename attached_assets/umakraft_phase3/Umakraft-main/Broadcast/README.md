# Broadcast

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v2.0.0
**Stage:** 5 — Broadcast (Deliver Notifications)
**Last Updated:** 2026-07-21

---

**STAGE 5: Deliver Notifications**

## Purpose

Manage notification lifecycle from trigger through delivery.

## Departments

| Department | Purpose |
|------------|----------|
| **Broker** | Notification entry point; scheduled triggers |
| **Archive-Inspector** | Notification approval authority; eligibility check; sole Archive writer |
| **Archive** | Persistent notification storage |
| **Archive-Transporter** | Fetch-and-handoff between Archive and Announcer |
| **Announcer** | Discord delivery |

## Pipeline Flow

```
Trigger → Broker → Archive-Inspector → Archive → Archive-Transporter → Announcer → Delivery
```

## Status

**IN PROGRESS** (v1.0.0 - v2.0.0)

Assimilating pending modules from fantracking/ and tasks/

## See Also

- `GOVERNANCE/PIPELINE_REGISTRY.md` — Broadcast stage specification
- `GOVERNANCE/PIPELINE_EVOLUTION.md` — Assimilation backlog
