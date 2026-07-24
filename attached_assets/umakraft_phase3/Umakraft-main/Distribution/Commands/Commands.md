# Commands

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 4 — Distribution (Coordinate User-Facing Application Flow)
**Department:** Commands
**Last Updated:** 2026-07-21

---

## Purpose

The **Commands** department is the front desk of the Distribution stage.

It receives every Discord slash command interaction forwarded from the Discord event layer, validates the user's input and permissions, and routes the request to the appropriate Coordinator action. It is the sole entry point for all user-triggered pipeline activity.

Commands does not process, orchestrate, or respond. It receives, validates, and routes.

---

## Pipeline Position

```text
Discord (interactionCreate event)
        │
        ▼  raw Discord interaction
    Commands
        │
   ┌────┴────┐
   │         │
Invalid     Valid
   │         │
   ▼         ▼
Error      Coordinator
Reply
(ephemeral)
```

---

## Responsibilities

- Receive Discord slash command interaction events forwarded from `Discord/events/interactionCreate.js`.
- Resolve the correct command handler from the loaded command collection.
- Validate command options and required parameters before any pipeline work begins.
- Perform permission checks (Manage Guild, Administrator, channel restrictions).
- Reject malformed or unauthorized input with an ephemeral error reply — without touching the pipeline.
- Build and pass a validated command payload to the Coordinator.
- Reply immediately with a deferred response when pipeline execution will take more than one second.

## Must Not

The Commands department must **never**:

- Call Umamoe, Refinery, or Workshop directly.
- Orchestrate pipeline execution or manage pipeline state.
- Construct Discord image renders, embeds, or final response payloads.
- Deliver non-error responses to Discord — that belongs to Dispatcher.
- Contain business logic or data transformations.
- Persist any data.

---

## Input

Raw Discord slash command interaction event, forwarded from `Discord/events/interactionCreate.js`.

```javascript
// Discord.js Interaction object (key fields)
{
  commandName:   string,      // e.g. "fan_gain"
  options:       object,      // OptionResolver — typed option access
  guildId:       string,
  channelId:     string,
  user:          { id, username, ... },
  member:        { permissions, ... },
  reply:         Function,    // Discord.js reply method
  deferReply:    Function,    // used for commands that trigger pipeline work
  followUp:      Function,
}
```

---

## Output

### Validated Command Payload (→ Coordinator)

```javascript
{
  commandName:  string,      // e.g. "fan_gain"
  interaction:  object,      // original Interaction — passed to Dispatcher for reply
  options: {
    // command-specific parsed options (typed, validated)
    member?:    object,      // resolved Discord GuildMember
    trainer?:   string,
    trainerId?: string,
    scope?:     string,      // "daily" | "weekly" | "monthly"
    circle?:    string,
    date?:      string,      // YYYY-MM-DD
    // ...
  },
  guildId:      string,
  userId:       string,
  channelId:    string,
}
```

### Early Error Reply (→ Discord, ephemeral)

Sent directly when validation fails. No Coordinator or Dispatcher involvement.

```javascript
interaction.reply({ content: "...", ephemeral: true })
```

---

## Validation Patterns

Each command handler performs the checks appropriate to that command. The following patterns are applied consistently:

| Check | When | Action on Fail |
|-------|------|---------------|
| Command handler exists | Always | Ignore unknown command (no reply) |
| Required options present | Always | Ephemeral error reply |
| Permission check (Manage Guild / Administrator) | Admin commands | Ephemeral "You need X permission" |
| Option type / format | Per-command | Ephemeral error with format hint |
| Channel restriction | Per-command | Ephemeral "This command can only be used in #channel" |
| Mutex options (`trainer` vs `trainer_id`) | Per-command | Ephemeral "Provide one of X or Y" |

---

## Deferred Replies

Commands that trigger pipeline work must defer their reply immediately to prevent Discord's 3-second interaction timeout.

```javascript
await interaction.deferReply({ ephemeral: false }); // public
await interaction.deferReply({ ephemeral: true });  // admin / utility commands
```

Dispatcher uses `interaction.editReply()` to fulfill the deferred response after the pipeline completes.

---

## Command Routing Table

All 28 commands route through Commands → Coordinator. The table below maps each command to its Coordinator action and deferred reply type.

### Member Commands

| Command | Coordinator Action | Deferred? | Reply Type |
|---------|-------------------|-----------|------------|
| `/fan_gain` | `fanGain(payload)` | ✅ public | Image |
| `/profile` | `profile(payload)` | ✅ public | Image |
| `/leaderboard` | `leaderboard(payload)` | ✅ public | Image |
| `/total_fan` | `totalFan(payload)` | ✅ public | Image |
| `/total_circlefan_gain` | `totalCircleFanGain(payload)` | ✅ public | Image |
| `/circle_master` | `circleMaster(payload)` | ✅ public | Image |
| `/intercircleleaderboard` | `interCircleLeaderboard(payload)` | ✅ public | Image |
| `/joindate` | `joinDate(payload)` | ✅ public | Embed / Image |
| `/memberlist` | `memberList(payload)` | ✅ public | Embed / Image |
| `/search_trainer` | `searchTrainer(payload)` | ✅ ephemeral | Image |
| `/store` | `storeCard(payload)` | ✅ ephemeral | Ephemeral embed |
| `/keep` | `keepCard(payload)` | ✅ ephemeral | Ephemeral embed |
| `/set_timezone` | `setTimezone(payload)` | ✅ ephemeral | Ephemeral embed |
| `/status` | `status(payload)` | ✅ ephemeral | Ephemeral embed |
| `/circle_status` | `circleStatus(payload)` | ✅ ephemeral | Ephemeral embed |
| `/club_gain` | `clubGain(payload)` | ✅ public | Image |
| `/help` | `help(payload)` | ✅ public | Image |

### Admin Commands

| Command | Coordinator Action | Permission | Deferred? | Reply Type |
|---------|-------------------|------------|-----------|------------|
| `/link` | `link(payload)` | Manage Guild | ✅ ephemeral | Ephemeral embed |
| `/unlink` | `unlink(payload)` | Manage Guild | ✅ ephemeral | Ephemeral embed |
| `/link_list` | `linkList(payload)` | Manage Guild | ✅ ephemeral | Image |
| `/set_fans` | `setFans(payload)` | Manage Guild | ✅ ephemeral | Ephemeral + Image |
| `/admin_sync` | `adminSync(payload)` | Manage Guild | ✅ ephemeral | Ephemeral embed |
| `/admin_setjoindate` | `adminSetJoinDate(payload)` | Manage Guild | ✅ ephemeral | Ephemeral embed |
| `/test_milestone` | `testMilestone(payload)` | Manage Guild | ✅ ephemeral | Ephemeral image |
| `/timeline_setup` | `timelineSetup(payload)` | Manage Guild | ✅ ephemeral | Ephemeral embed |
| `/timeline_post` | `timelinePost(payload)` | Manage Guild | ✅ public + ephemeral | Public + Ephemeral |
| `/admin_syncCards` | `adminSyncCards(payload)` | Administrator | ✅ ephemeral | Ephemeral embed |
| `/warningsettings` | `warningSettings(payload)` | Administrator | ✅ ephemeral | Ephemeral embed |

---

## Implementation Structure

```text
Distribution/Commands/
├── Commands.md         — this document
├── index.js            — loads all handlers and exposes execute(interaction)
└── handlers/
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
    ├── store.js
    ├── keep.js
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

Each handler exports:

```javascript
// handlers/fanGain.js
export const name = 'fan_gain';
export async function execute(interaction, coordinator) { ... }
```

---

## Design Principle

Commands is intentionally **thin**.

Its only job is to be the clean boundary between Discord and the rest of the pipeline. Every slash command has exactly one handler. Handlers contain no business logic — only validation, permission checks, and routing.

If logic is growing inside a command handler, it belongs in the Coordinator, not here.

---

## Related Documents

| Document | Relevance |
|----------|-----------|
| `GOVERNANCE/ARCHITECTURE_AUTHORITY.md` | Constitutional authority |
| `Distribution/Discord/events/events.md` | Upstream — forwards interactions to Commands |
| `Distribution/Coordinator/Coordinator.md` | Downstream — receives validated payloads |
| `Distribution/Discord/commands/commands.md` | Command definitions — interface specs for all 28 commands |
