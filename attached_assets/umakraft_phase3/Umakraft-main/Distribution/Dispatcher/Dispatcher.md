# Dispatcher

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Dispatcher
**Last Updated:** 2026-07-21

---

## Purpose

The **Dispatcher** department is the delivery clerk of the Distribution stage.

It receives finished deliverables or error envelopes from the Coordinator and sends the appropriate response to Discord — a PNG image attachment, an embed, a plain message, or a user-facing error reply.

The Dispatcher is the only department in Distribution that communicates outward to Discord with a final response.

---

## Pipeline Position

```text
Coordinator
        │
        ├── Finished Deliverable { success: true, png, blueprintKey, meta, interaction }
        │
        └── Error Envelope { success: false, failedAt, error, message, interaction }
        │
        ▼
   Dispatcher
        │
        ├── Image commands   → PNG attachment (interaction.editReply)
        ├── Embed commands   → Discord embed (interaction.editReply)
        ├── Hybrid commands  → PNG + ephemeral embed confirmation
        └── Error            → Ephemeral user-facing error message
        │
        ▼
Discord API → User
```

---

## Responsibilities

- Receive finished deliverables or error envelopes from the Coordinator.
- Determine the correct Discord response type based on `blueprintKey` or result type.
- Format the PNG buffer into a Discord `AttachmentBuilder` for image commands.
- Format embed data into a `EmbedBuilder` for utility and admin commands.
- Resolve the correct Discord reply method (`editReply`, `followUp`) based on whether the interaction was deferred.
- Send the formatted payload to Discord via the interaction object.
- Handle Discord API delivery errors (rate limits, unknown channel, missing permissions) with one retry where safe.
- Translate all Coordinator error envelopes into clear, user-facing ephemeral messages.
- Log all delivery attempts and outcomes.

## Must Not

The Dispatcher must **never**:

- Call Umamoe, Refinery, or Workshop directly.
- Orchestrate pipeline execution — that belongs to Coordinator.
- Receive Discord slash command events — that belongs to Commands.
- Construct business logic or derive data content.
- Modify the content of a PNG deliverable.
- Persist deliverables or pipeline state.

---

## Input

### Finished Deliverable (from Coordinator)

```javascript
{
  success:       true,
  blueprintKey:  string,   // determines response type
  blueprintName: string,
  png:           Buffer,   // present for image commands
  meta:          object,   // trainer/product metadata
  interaction:   object,   // Discord.js Interaction — for reply
  // utility commands may include result data instead of png
  result?:       object,
}
```

### Error Envelope (from Coordinator)

```javascript
{
  success:     false,
  failedAt:    string,
  error:       string,
  message:     string,
  retriable:   boolean,
  interaction: object,
}
```

---

## Response Types

| Command Type | Discord Method | Payload |
|-------------|---------------|---------|
| Image command (public) | `interaction.editReply()` | `AttachmentBuilder` from PNG buffer |
| Image command (ephemeral) | `interaction.editReply({ ephemeral: true })` | `AttachmentBuilder` from PNG buffer |
| Embed command (ephemeral) | `interaction.editReply({ ephemeral: true })` | `EmbedBuilder` |
| Hybrid (image + embed) | `interaction.editReply()` then `interaction.followUp()` | PNG + ephemeral embed |
| Error reply | `interaction.editReply({ ephemeral: true })` | Plain string or `EmbedBuilder` |

---

## Response Routing

The Dispatcher resolves the correct response format from `blueprintKey` or the presence of `png`:

```text
Receive from Coordinator
        │
        ▼
success === false?
        │
    YES │  NO
        │   │
        ▼   ▼
  Format   png present?
  Error        │
  Reply    YES │  NO
  (eph)        │   │
               ▼   ▼
          Image  Embed / Result
          Reply     Reply
```

---

## Error Reply Mapping

The Dispatcher translates pipeline error codes into user-facing messages. Raw error codes are never shown to the user.

| `failedAt` / `error` | User-Facing Message |
|---------------------|---------------------|
| `Umamoe` / `MINER_*` | "Could not retrieve data right now. Please try again shortly." |
| `Inspector` / `*_FAILURE` | "The data returned from Uma.moe was not valid. Try again or contact an admin." |
| `Workshop/Validator` / `*_FAILURE` | "The image could not be generated. Please try again shortly." |
| `Terminal` / `TERMINAL_*` | "The deliverable could not be staged. Please try again shortly." |
| Member not linked | "This member has not been linked to an Uma.moe account. Use `/link` to set one up." |
| Not found | "No data found for this member. Try again after the next sync." |
| Permission denied | "You do not have permission to use this command." |
| Unknown / fallback | "Something went wrong. Please try again shortly." |

---

## Discord API Error Handling

| Discord Error | Action |
|--------------|--------|
| Rate limit (`429`) | Wait the `retry_after` duration, then retry once |
| Unknown interaction (`10062`) | Log and drop — interaction has expired |
| Missing permissions | Log with full context, reply with permission error message |
| Unknown channel (`10003`) | Log and drop — channel was deleted |
| Any other API error | Log with full context, attempt one retry; if retry fails, drop and log |

Undeliverable responses are always logged with the original payload preserved for diagnostics. Failed deliveries are never silently dropped without a log entry.

---

## Implementation Structure

```text
Distribution/Dispatcher/
├── Dispatcher.md      — this document
├── index.js           — exports dispatch(deliverable | errorEnvelope)
├── formatImage.js     — PNG buffer → Discord AttachmentBuilder
├── formatEmbed.js     — result data → Discord EmbedBuilder
├── formatError.js     — error envelope → user-facing error message
└── send.js            — Discord API delivery with retry logic
```

---

## Design Principle

The Dispatcher owns **delivery**, nothing else.

It does not decide what to say — the Coordinator and Workshop have already determined that. It only decides how and where to say it on Discord. If response formatting logic is growing complex, the Coordinator is not providing enough context in its output envelope — not a sign that the Dispatcher should contain more logic.

One deliverable → one Discord response.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority |
| `Distribution/Coordinator/Coordinator.md` | Upstream — sends finished deliverables and error envelopes |
| `Distribution/Discord/Discord.md` | Platform adapter — provides shared Discord utilities |
| `Workshop/Terminal/Terminal.md` | Terminal — source of the PNG buffer the Coordinator claims |
