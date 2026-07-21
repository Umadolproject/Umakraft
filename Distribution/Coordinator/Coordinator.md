# Coordinator

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Coordinator
**Last Updated:** 2026-07-21

---

## Purpose

The **Coordinator** department is the case manager of the Distribution stage.

It receives validated command payloads from Commands, determines which pipeline stages are needed, calls them in the correct order, retrieves the finished deliverable from the Workshop/Terminal, and hands it to the Dispatcher.

The Coordinator is the only department in Distribution that communicates with upstream pipeline stages.

---

## Pipeline Position

```text
Commands (validated command payload)
        │
        ▼
   Coordinator
        │
        ├──► umamoe/pipeline.js
        │         Miner → Courier → Inspector → Vault
        │         Refiner → Compiler → Depot
        │
        ├──► Workshop/pipeline.js → produce(compiledProduct)
        │         Draftsman → Fabricator → Validator → Terminal
        │
        └──► Workshop/pipeline.js → claimDeliverable(terminalId)
                  Terminal → PNG buffer
        │
        ▼  finished deliverable (success) or error envelope (failure)
   Dispatcher
```

---

## Responsibilities

- Receive validated command payloads from Commands.
- Determine which pipeline stages are required for each command.
- Call `umamoe/pipeline.js` to acquire and process raw data through Umamoe and Refinery.
- Call `Workshop/pipeline.js → produce()` to fabricate, validate, and stage the deliverable.
- Call `Workshop/pipeline.js → claimDeliverable()` to retrieve the PNG buffer from the Terminal.
- Produce structured error envelopes when any stage fails.
- Pass the finished deliverable or error envelope to the Dispatcher.
- Log all stage transitions and failures with full context.

## Must Not

The Coordinator department must **never**:

- Receive Discord events directly — Commands is the sole entry point.
- Deliver responses to Discord — that belongs to Dispatcher.
- Construct Discord embeds, image payloads, or message formatting.
- Validate Discord command input — that belongs to Commands.
- Contain rendering or visual logic.
- Persist data beyond the lifecycle of a single command request.
- Call pipeline stages out of order — pipeline direction is forward-only.

---

## Input

Validated command payload from Commands.

```javascript
{
  commandName:  string,
  interaction:  object,    // Discord.js Interaction — passed through to Dispatcher
  options:      object,    // command-specific parsed options
  guildId:      string,
  userId:       string,
  channelId:    string,
}
```

---

## Output

### Finished Deliverable (→ Dispatcher)

```javascript
{
  success:       true,
  terminalId:    string,
  blueprintKey:  string,
  blueprintName: string,
  png:           Buffer,   // PNG image — ready for Discord attachment
  meta:          object,   // trainer/product metadata
  interaction:   object,   // original Interaction — for Dispatcher to reply
}
```

### Error Envelope (→ Dispatcher)

```javascript
{
  success:     false,
  failedAt:    string,   // e.g. "Umamoe", "Workshop/Validator", "Terminal"
  error:       string,   // e.g. "INSPECTOR_REJECTION", "FABRICATOR_RENDER_ERROR"
  message:     string,   // internal — not shown to user
  retriable:   boolean,
  interaction: object,   // original Interaction — for Dispatcher to send error reply
}
```

---

## Pipeline Orchestration

### Standard Image Command (full pipeline)

Used by: `/fan_gain`, `/profile`, `/leaderboard`, `/total_fan`, `/total_circlefan_gain`, `/circle_master`, `/intercircleleaderboard`, `/joindate`, `/memberlist`, `/club_gain`, `/help`, `/link_list`, `/set_fans`, `/test_milestone`.

```text
1. Resolve trainerId from payload options
   (member lookup → linked trainerId, or direct trainerId from options)

2. umamoe/pipeline.js → processTrainer(trainerId, options)
   → if failed: return error envelope

3. Workshop/pipeline.js → produce(compiledProduct)
   compiledProduct from Refinery/Depot
   → if failed: return error envelope

4. Workshop/pipeline.js → claimDeliverable(terminalId)
   → if failed: return error envelope

5. Return finished deliverable { success: true, png, blueprintKey, meta, interaction }
```

### Utility / Admin Commands (no pipeline render)

Used by: `/link`, `/unlink`, `/admin_sync`, `/admin_setjoindate`, `/status`, `/circle_status`, `/set_timezone`, `/warningsettings`, `/admin_syncCards`, `/keep`, `/store`, `/timeline_setup`, `/timeline_post`.

```text
1. Perform the required operation (read/write config, trigger sync, etc.)
   May call Umamoe or database directly for admin operations.

2. Build a structured result object (not a Workshop deliverable).

3. Return result to Dispatcher — no PNG buffer, no Terminal claim.
```

### Search Command (`/search_trainer`)

```text
1. Query the trainer card database directly (no Umamoe or Workshop).
2. Return paginated result set to Dispatcher.
```

---

## Error Handling

- If any stage returns `success: false`, stop pipeline execution immediately.
- Build and return a structured error envelope to Dispatcher — never surface raw pipeline error messages to the user.
- Include `failedAt` to identify the stage for diagnostics.
- Set `retriable: true` for transient failures (network errors, rate limits, temporary API failures). Set `retriable: false` for data validation failures or not-found conditions.
- Log every failure with full context (commandName, userId, guildId, error code).

### Retry Policy

- The Coordinator does **not** retry internally — retries are the responsibility of the individual pipeline stages (Miner uses exponential backoff).
- One re-attempt is permitted for `retriable: true` errors at the Coordinator level only when the failure is a Terminal claim race condition (`TERMINAL_ALREADY_CLAIMED`).
- All other failures propagate immediately to Dispatcher as an error envelope.

---

## Coordinator Action Map

Each slash command maps to exactly one Coordinator action. The action owns the full orchestration for that command.

```text
Distribution/Coordinator/
├── Coordinator.md         — this document
├── index.js               — exports all actions
└── actions/
    ├── fanGain.js
    ├── profile.js
    ├── leaderboard.js
    ├── totalFan.js
    ├── totalCircleFanGain.js
    ├── circleMaster.js
    ├── interCircleLeaderboard.js
    ├── joinDate.js
    ├── memberList.js
    ├── searchTrainer.js
    ├── storeCard.js
    ├── keepCard.js
    ├── setTimezone.js
    ├── status.js
    ├── circleStatus.js
    ├── clubGain.js
    ├── help.js
    ├── link.js
    ├── unlink.js
    ├── linkList.js
    ├── setFans.js
    ├── adminSync.js
    ├── adminSetJoinDate.js
    ├── testMilestone.js
    ├── timelineSetup.js
    ├── timelinePost.js
    ├── adminSyncCards.js
    └── warningSettings.js
```

---

## Design Principle

The Coordinator owns **orchestration**, not implementation.

It knows which pipeline stages to call and in what order, but it does not contain the logic of those stages. If business logic is appearing inside a Coordinator action, it belongs in Refinery. If rendering logic is appearing, it belongs in Workshop.

One command → one Coordinator action → one deliverable or result.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority |
| `Distribution/Commands/Commands.md` | Upstream — sends validated payloads |
| `Distribution/Dispatcher/Dispatcher.md` | Downstream — receives finished deliverable or error envelope |
| `Workshop/pipeline.js` | Workshop wire — `produce()` and `claimDeliverable()` |
| `umamoe/pipeline.js` | Stage 1+2 wire — `processTrainer()` and `processRankings()` |
| `Workshop/Terminal/Terminal.md` | Terminal — staging area for finished deliverables |
