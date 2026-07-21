# Distribution

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Last Updated:** 2026-07-21

---

## Purpose

Distribution is the user-facing stage of the UmaKraft pipeline.

It receives every Discord slash command, orchestrates the upstream pipeline stages needed to fulfil it, and returns a finished deliverable to the user. It is the only stage that communicates directly with Discord.

Distribution does not acquire data, refine it, or render it. Those responsibilities belong to Umamoe, Refinery, and Workshop. Distribution only coordinates and delivers.

---

## Pipeline Position

```text
Workshop / Terminal
        │
        ▼  (finished deliverable — PNG buffer + metadata)
   Distribution
  ┌─────────────────────────────────────────────────┐
  │                                                 │
  │  Discord ──► events/ ──► Commands               │
  │                │             │                  │
  │          commands/     (validate + route)        │
  │          (definitions)       │                  │
  │                              ▼                  │
  │                         Coordinator             │
  │                    (orchestrate pipeline)        │
  │                              │                  │
  │                              ▼                  │
  │                         Dispatcher              │
  │                    (deliver to Discord)          │
  │                                                 │
  └─────────────────────────────────────────────────┘
        │
        ▼  (compiled product — notification path only)
     Broadcast
```

Distribution sits at the junction of two independent delivery paths that originate from the Refinery/Depot:

| Path | Trigger | Flow | Delivery Owner |
|------|---------|------|---------------|
| **Command path** | Discord slash command | Depot → Workshop → Distribution → Discord | Distribution/Dispatcher |
| **Notification path** | Cron or data threshold | Depot → Broadcast → Discord | Broadcast/Announcer |

These paths never merge. Distribution never fires automatic notifications. Broadcast never responds to slash commands.

---

## Departments

| Department | File | Analogy | Responsibility |
|------------|------|---------|---------------|
| **Discord** | `Discord/Discord.md` | Platform adapter | Owns the raw Discord API surface — event handlers, slash command definitions, client init |
| **Commands** | `Commands/Commands.md` | Front desk | Receives forwarded interactions, validates input, routes to Coordinator |
| **Coordinator** | `Coordinator/Coordinator.md` | Case manager | Orchestrates pipeline calls, retrieves deliverables from Terminal |
| **Dispatcher** | `Dispatcher/Dispatcher.md` | Delivery clerk | Resolves Discord destination, formats payload, sends response |

---

## Internal Flow

### Happy Path (slash command → image response)

```text
User runs /fan_gain
      │
      ▼
Discord (interactionCreate event fires)
      │
      ▼  raw interaction event
events/interactionCreate.js → Commands
      │
      ▼  validated command payload
Coordinator
      │  orchestrates:
      ├─► umamoe/pipeline.js → processTrainer(trainerId)
      │         Miner → Courier → Inspector → Vault → Refiner → Compiler → Depot
      │
      ├─► Workshop/pipeline.js → produce(compiledProduct)
      │         Draftsman → Fabricator → Validator → Terminal
      │
      └─► Workshop/pipeline.js → claimDeliverable(terminalId)
                Terminal → PNG buffer
      │
      ▼  finished deliverable { png, blueprintKey, meta, ... }
Dispatcher
      │
      ▼  PNG attachment + optional embed
Discord API (channel reply)
```

### Error Path

```text
Any stage fails
      │
      ▼  structured error envelope { failedAt, error, message, retriable }
Coordinator → Dispatcher
      │
      ▼  user-facing ephemeral error message
Discord API
```

---

## Envelope Shapes

### Validated Command Payload (Commands → Coordinator)

```javascript
{
  commandName:   string,    // e.g. "fan_gain"
  interaction:   object,    // raw Discord.js Interaction object
  options: {
    // command-specific parsed options
    trainerId?:  string,
    member?:     object,
    scope?:      string,
    // ...
  },
  guildId:       string,
  userId:        string,
  channelId:     string,
}
```

### Finished Deliverable (Coordinator → Dispatcher)

```javascript
{
  success:       true,
  terminalId:    string,
  blueprintKey:  string,
  png:           Buffer,
  meta:          object,
  interaction:   object,    // original Discord.js Interaction (for reply)
}
```

### Error Envelope (Coordinator → Dispatcher)

```javascript
{
  success:       false,
  failedAt:      string,    // e.g. "Umamoe", "Workshop/Validator"
  error:         string,    // e.g. "PIPELINE_STAGE_ERROR"
  message:       string,
  retriable:     boolean,
  interaction:   object,    // original Discord.js Interaction (for error reply)
}
```

---

## Ownership Rules

- **Discord** is the sole owner of all raw Discord API files — event handlers, slash command definitions, client initialization, and the deploy script.
- **Commands** is the sole department that validates and routes Discord interactions into the pipeline.
- **Coordinator** is the sole department that calls upstream pipeline stages (Umamoe, Refinery, Workshop).
- **Dispatcher** is the sole department that delivers responses outward to Discord.

No department may assume another's responsibility.

---

## Command Registry

Distribution currently handles **28 slash commands** across two permission tiers.

See `Discord/commands/commands.md` for the full registry.

| Tier | Count | Permission |
|------|-------|------------|
| Member commands | 17 | None (all members) |
| Admin commands | 11 | Manage Guild or Administrator |

---

## File Structure

```text
Distribution/
├── README.md                  — this document
├── Commands/
│   └── Commands.md            — front desk spec
├── Coordinator/
│   └── Coordinator.md         — case manager spec
├── Dispatcher/
│   └── Dispatcher.md          — delivery clerk spec
└── Discord/
    ├── Discord.md             — platform adapter spec
    ├── commands/              — slash command definitions (28 files)
    │   └── commands.md        — command registry index
    └── events/
        └── events.md          — gateway event handler spec
```

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority — supreme law |
| `GOVERNANCE/PIPELINE_REGISTRY.md` | Official department registry and ownership rules |
| `GOVERNANCE/PIPELINE_OPERATIONS.md` | Operational standards and daily execution |
| `Workshop/Terminal/Terminal.md` | Upstream — Terminal hands finished deliverables to Coordinator |
| `Broadcast/README.md` | Parallel notification path — does not merge with Distribution |
| `docs/PIPELINE_DESIGN.md` | Full pipeline construction reference |
