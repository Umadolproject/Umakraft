# UmaKraft Slash-Command Failure Sample

Investigation date: 2026-07-23

This document is a repository-specific failure catalog for the UmaKraft Discord
bot. It is intentionally broader than the current incident: it lists causes
that can make a slash command appear to do nothing, show **“The application
did not respond”**, show **“This interaction failed”**, or return an error
after acknowledgement.

## Current incident assessment

The strongest current evidence is:

1. The Railway container starts.
2. `interactionCreate` is registered.
3. Thirty command handlers load.
4. Discord login succeeds as `UmaKraftCircleBot#8905`.
5. The bot reaches `READY`.
6. The local AI model has been changed to lazy loading, so startup no longer
   waits for the model.
7. Railway logs still contain neither:

   ```text
   [discord/raw] interactionCreate received /status
   [interactionCreate] Received /status
   ```

That means the current failure is most likely **before command routing**:
Railway is not the process receiving the interaction, Railway is running a
different/stale build, Discord is delivering the command to a different
application installation, or the command is not being invoked in the guild
served by this process.

This is not currently consistent with the local AI model blocking `/status`.
`/status` does not call the AI service, and the bot reaches `READY` before any
AI request.

The runtime source now contains a gateway-level probe:

```text
[discord/raw] interactionCreate received /status
```

After Railway deploys the commit containing that probe, one fresh `/status`
attempt is enough to separate gateway delivery from handler/dispatcher bugs.

## How to read the diagnosis

| Log result after one command attempt | Meaning |
|---|---|
| No raw probe and no `Received` line | Discord did not deliver the interaction to this process, or this is not the live process/build |
| Raw probe appears, but no `Received` line | The dynamic event handler is not attached, crashed before routing, or the deployed files differ from the expected source |
| `Received /status`, but no `Completed` line | The command, coordinator, or dispatcher threw or hung |
| `Received /status` followed by `Dispatch also failed` | The bot handled the command but could not send the response |
| `Completed /status`, but Discord still shows failure | Wrong Discord client/application, stale UI, duplicate installation, or the response was sent to a different interaction |
| `Interaction expired (10062)` | The initial acknowledgement or later response missed Discord's validity window |

## Ranked causes for the current incident

### 1. Railway is not running the intended GitHub commit

The repository has a Railway Docker deployment, but the available deployment
metadata reports no successful Replit build and Replit's deployment metadata is
separate from Railway's deployment. Verify the Railway deployment commit,
image timestamp, and startup line for the raw probe. Do not infer Railway's
state from the Replit preview.

### 2. Railway is not the only process using the token

The local Replit bot was stopped, but another Railway service, an old Railway
deployment, a VM, a local machine, or another host may still be logged in with
the same token. Stop every old process and leave exactly one gateway client.

### 3. The command is installed for a different application or guild

The repository registers guild commands using `DISCORD_CLIENT_ID` and
`DISCORD_GUILD_ID`. Confirm the command's application ID, guild ID, and
installation all match the bot that logs in as `UmaKraftCircleBot#8905`.

### 4. The Discord command UI is stale

A command can remain visible from an older application registration or cached
client state. Compare the command IDs returned by the Discord API with the
current application and guild, then restart Discord or test from a fresh
client session.

### 5. Railway has a different `DISCORD_TOKEN`

The token is intentionally not inspected or printed. A valid token can still
belong to another bot application. Compare the bot identity shown by Railway's
`READY` line with the application that owns the visible commands.

### 6. Railway has incorrect application or guild variables

`core/botConfig.js` reads `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID` from the
environment. A mismatch can register commands in one guild while the running
bot is tested in another. Verify values without exposing secrets.

### 7. Railway has not restarted after the source push

Pushing GitHub does not guarantee that the active Railway container has
restarted. Verify the deployment start timestamp is later than the commit and
that its image contains the raw probe.

### 8. The active Railway service uses a different branch or repository

Railway may point to a branch other than `main`, a different GitHub project, or
a manually configured image. Verify the Railway source repository, branch,
service, and build trigger.

### 9. A duplicate client is receiving the gateway session

Discord gateway sessions and deployments can behave unpredictably when old
instances remain alive. The intended architecture is one persistent bot
process, not one autoscaled replica per request.

### 10. The command is being tested in a different guild

The bot reports `Serving 1 guild(s)`, but that does not prove the tested guild
is the guild where the command was registered. Check the guild ID in Discord
and the guild cache at runtime.

## Failure catalog

### Discord delivery, installation, and registration

### 11. The bot was not installed with the `applications.commands` scope

The bot token can log in while slash commands are unavailable or associated
with an incomplete installation. Reinstall the application using both
`bot` and `applications.commands` scopes.

### 12. The bot is not installed in the tested guild

Seeing a command in a client does not prove that the current bot user is
installed in that guild. Check the server member list and application
integration settings.

### 13. The user lacks permission to use the command

Admin commands use `.setDefaultMemberPermissions(...)`. Discord can hide or
reject those commands for users without `ManageGuild` or `Administrator`.
This normally differs from a timeout, but it must be checked for
`/admin_*`, `/link`, `/set_fans`, and related commands.

### 14. A channel or role permission overrides application-command access

Discord channel overwrites can block a bot from viewing or responding in a
channel even when the guild installation is correct. Test `/status` in a
simple channel where the bot has View Channel, Send Messages, and Embed Links.

### 15. The command was registered globally but tested immediately

`deploy-commands.js --global` uses global routes, which can take a long time to
propagate. Guild registration is the intended development path because it is
near immediate.

### 16. The command was registered in a guild and then tested globally

Guild and global command records are different. Confirm which route was used
by the deployment log:

```text
Routes.applicationGuildCommands(...)
Routes.applicationCommands(...)
```

### 17. A later bulk command deployment replaced the command set

`deploy-commands.js` uses `rest.put`, which replaces the complete command
collection for the selected route. Running an older copy can delete or replace
commands from the current source.

### 18. The command name differs by underscore or spelling

The source uses names such as `fan_gain`, `circle_status`,
`intercircleleaderboard`, and `total_circlefan_gain`. Discord command names
must match the registered names exactly.

### 19. The visible command is from an older command schema

The registered command may have old options or subcommands even after the
handler changed. Compare the live JSON command definition with
`Distribution/Discord/deploy-commands.js`.

### 20. A required option is missing or malformed in the live schema

The handlers use strict getters such as
`getString('question', true)` and `getSubcommand()`. A stale schema can cause
the client and handler to disagree about available options.

### 21. A command is visible in a DM but only works in a guild

Many handlers read `interaction.guildId`, `channelId`, or guild member data.
The repository deploys guild-oriented commands; test in the configured guild,
not a DM.

### 22. Discord's interaction was sent to another bot application

Two applications can have the same command name. The visual `/status` label
does not identify which application owns the command. Inspect the command
application ID and test after disabling the other application.

### 23. Discord is retrying or displaying an old failed interaction

An interaction is a single event. Retrying the same visible UI state is not
the same as producing a new event. Capture a fresh command attempt and its
interaction ID.

### 24. The application command was disabled by guild integration settings

Guild command permissions and integration settings can disable a command for a
role or channel without changing the bot process. Review Discord's command
permissions UI.

### 25. Discord API or gateway regional interruption

A temporary Discord incident can prevent delivery or acknowledgement. Compare
the exact attempt time with Discord status and test a second guild or a simple
new command after the service recovers.

### 26. Gateway session resumed incorrectly after deployment

An old process can resume a gateway session while a new process appears
healthy. A full stop of old instances followed by one clean login is the
relevant test.

### 27. The gateway is connected as the wrong bot user

The `READY` log is the authoritative identity signal. It must match the bot
whose slash commands are visible. A successful login alone is insufficient.

### 28. The bot has been removed from the guild after registration

Guild command records can remain while the bot member is absent. Reinvite the
same application and verify the guild count on the new process.

### 29. The command was deployed to the wrong guild ID

`DISCORD_GUILD_ID` is not hardcoded in `deploy-commands.js`; it comes from the
environment. A stale variable is enough to make registration look successful
while testing in another guild.

### 30. Registration succeeded using one token but runtime uses another

Command deployment and runtime login both read `DISCORD_TOKEN`, but they may be
run in different environments. A successful registration log proves only that
the deployment environment's token worked.

### Runtime startup and event registration

### 31. The process exited after the uploaded startup log ended

The health server can start before Discord login, so an HTTP health check alone
does not prove the bot remains alive. Confirm a current `READY` line and a
continuous process after the command attempt.

### 32. Railway restarted the container between `READY` and the command

OOM, health-check failure, deployment replacement, or restart policy can leave
a short window in which Discord shows a command but no process receives it.
Correlate container uptime and command time.

### 33. Railway's `restartPolicyMaxRetries = 5` exhausted

The repository uses `on_failure` with five retries. After repeated crashes the
service may stay unavailable while an old Discord UI continues to show
commands.

### 34. The process was killed by memory pressure

Before lazy loading, the Hugging Face model increased memory substantially.
The current startup path is lighter, but image pipelines and the first AI
request can still raise RSS. Check Railway termination reason, not only
application logs.

### 35. The health server reports `ok` while Discord is not ready

`/health` returns `status: "ok"` even when `botReady` is false. A proxy or
Railway health check can therefore pass while slash commands cannot work.
Use both fields.

### 36. `botReady` is stale during disconnect handling

The process sets `botReady = false` on `disconnect`, but the browser or probe
may read an earlier response. Check the live gateway logs and not a cached
health response.

### 37. The dynamic event import fails

`index.js` imports every `.js` file in `Distribution/Discord/events`. An
import-time failure can prevent an event from being registered. The startup
log must contain:

```text
[startup] Registered event: interactionCreate
```

### 38. The wrong event file is present in the Docker image

Docker build context, `.dockerignore`, or a stale image can omit or preserve an
old `events/interactionCreate.js`. Check the deployed commit and image contents.

### 39. The raw probe is present but the dynamic handler is absent

The raw probe is registered directly in `Distribution/Discord/index.js`; the
real handler is registered by dynamic import. A raw line without a handler
line isolates a registration/import problem.

### 40. An exception is thrown before `interactionCreate` routing

Discord.js may construct an interaction that fails in a listener or wrapper
before the command handler. Compare raw probe, handler receipt, and process
`uncaughtException` logs.

### 41. `interaction.isChatInputCommand()` returns false

The handler intentionally ignores buttons, selects, autocomplete, and other
interaction types. The raw probe prints `type=...` for non-chat interactions.

### 42. The command map is empty or incomplete in the deployed image

`Distribution/Commands/index.js` uses `readdirSync` plus dynamic imports. The
startup log currently says `Loaded 30 commands`; any other count is a release
or filesystem problem.

### 43. A handler module has a duplicate exported command name

`new Map(handlers.map(...))` silently keeps the last duplicate name. This can
route a command to an unexpected handler without a startup error.

### 44. The handler name does not match the registered command name

Routing uses `client.commands.get(interaction.commandName)`, while registration
uses `setName(...)`. A mismatch produces `Unknown command` and should normally
send an error; if that error also fails, Discord displays a timeout.

### 45. The handler returns before sending any envelope

The interaction event throws `Command returned no response envelope` when an
execute function returns `undefined`, but a handler can also return a malformed
object that the dispatcher cannot deliver.

### 46. A handler throws while reading an option

Examples include `getSubcommand()` on the wrong live schema or strict getters
for missing options. The centralized catch should respond, unless the response
itself fails.

### 47. A handler calls an unrecognized coordinator action

Handlers call actions such as `coordinator.status`, `coordinator.aiCommand`,
and `coordinator.warningSettings`. A spelling mismatch causes a synchronous
or asynchronous error after acknowledgement.

### 48. A coordinator action hangs indefinitely

The centralized acknowledgement protects the first three seconds, but there is
no general command timeout in `interactionCreate.js`. A network call, image
render, database operation, or scheduler call can leave the deferred reply
pending forever.

### 49. A coordinator action rejects after the interaction expires

The catch path attempts an error response, but Discord can reject it with
10062 after the interaction token expires. This produces a log but no visible
Discord message.

### 50. The first AI command performs lazy model loading too slowly

After the memory optimization, `/ask` and `/ai` load the model on demand.
They must defer first, which the centralized event does, but the first response
can still be slow or hit downstream time limits.

### 51. A non-AI command accidentally imports heavy AI dependencies

`Coordinator/index.js` imports `aiGateway.js` alongside all other actions.
If a future AI module performs work at import time, every command startup can be
affected even though `/status` does not call AI.

### 52. `client` is missing from a handler payload

`status.js` expects the third `client` argument and uses `client.guilds.cache`.
The event currently passes it, but an older deployed `interactionCreate.js`
would produce a degraded or failing status response.

### 53. `interaction.user` is absent in a nonstandard interaction

Most handlers read `interaction.user.id` without optional chaining. A malformed
or unexpected interaction shape can throw before the coordinator call.

### 54. `interaction.guildId` is null

Many actions assume guild context. DM execution can pass a null guild ID into
database or member-resolution code and fail after acknowledgement.

### 55. A handler performs a second real `deferReply`

The event now wraps legacy `deferReply()` calls in a safe proxy, but an older
deployed handler or a path using the original interaction can still produce
Discord error 40060, “Interaction has already been acknowledged.”

### 56. A handler calls `reply()` after the central defer in an old build

The proxy translates legacy `reply()` to `editReply()`. If the deployed build
does not include the proxy, validation paths in admin, unlink, timeline, and
warning handlers can fail after the initial acknowledgement.

### 57. The proxy is lost in a returned envelope

The event restores `result.interaction.__originalInteraction` before dispatch.
If a new handler wraps, clones, or hides the interaction differently, the
dispatcher may call methods on a Proxy instead of the real Discord object.

### 58. A command reports success without `content`, `result`, or `png`

`Distribution/Dispatcher/index.js` logs an unrecognized envelope and performs
no delivery for this shape. This looks like a command that timed out even
though the handler completed.

### 59. An embed result is malformed

`formatEmbed()` can reject invalid fields, overlong text, or unsupported values.
The catch path then has to send an error through the same interaction.

### 60. An image attachment is invalid or too large

Image commands use `formatImage()` and `send()` with `files`. Puppeteer output,
corrupt buffers, or Discord attachment limits can make the response fail after
the interaction was acknowledged.

### Dispatcher and Discord response failures

### 61. `send()` chooses the wrong response method

The method is selected from `followUp`, `interaction.deferred`, and
`interaction.replied`. A stale or proxied state can select `editReply` when
`reply` or `followUp` is required.

### 62. `editReply()` is called without a valid initial acknowledgement

This can happen with an old event build, a handler that bypasses the proxy, or
a failed `deferReply()` call. Discord then returns an interaction response
error.

### 63. `reply()` is attempted after an interaction was already acknowledged

Discord error 40060 is expected when a path double-replies. Search logs for
“already been acknowledged” or code 40060.

### 64. A follow-up is sent after the interaction token expires

Long-running image or AI jobs can outlive the interaction token. The current
sender only has special handling for error code 10062 and does not persist
results elsewhere.

### 65. Discord returns error 10062

`send.js` logs `Interaction expired (10062)` and returns without throwing. If
this is the only response log, the command was too slow or the process was
temporarily disconnected.

### 66. Discord returns error 40060

This indicates a second acknowledgement. Inspect handler-level explicit
`deferReply()` and `reply()` calls against the centralized event behavior.

### 67. Discord returns error 50001

The bot lacks access to the channel or guild resource. Check View Channel and
Send Messages permissions.

### 68. Discord returns error 50013

The bot lacks permission for the requested action, such as posting in a
channel, embedding links, attaching files, or managing guild settings.

### 69. Discord returns error 50035

The response payload or command payload is invalid. Common repository paths
include embed formatting, attachment metadata, command option schema, and
overlong content.

### 70. Discord returns error 429

`send.js` retries once using `retryAfter`, but a sustained rate limit can still
fail. Multiple duplicate bot processes make this more likely.

### 71. The error formatter returns content longer than Discord allows

`formatError()` is the final error path. If it creates an overlong response,
both the original command and its error response can fail.

### 72. The response has an invalid ephemeral combination

The command's deferred visibility and the later response visibility must be
compatible. The central event defers using `command.ephemeral`; the dispatcher
uses the envelope's `ephemeral` value.

### 73. A response contains an empty embed

The dispatcher treats `envelope.result` as an embed deliverable. A null,
empty, or unsupported result can make `formatEmbed()` fail.

### 74. Content is empty after trimming

The dispatcher substitutes a fallback text for empty content, but a malformed
envelope without `content`, `result`, or `png` produces no response at all.

### 75. The error path itself throws

The catch block calls `dispatch(errPayload)`. If `formatError`, `send`, or the
interaction API fails, the only visible evidence is:

```text
[interactionCreate] Dispatch also failed:
```

### 76. The process logs an error but Discord receives no message

Console error handling is not a Discord delivery guarantee. Always pair
`Unhandled error`, `Dispatch also failed`, and Discord API error codes with the
interaction ID.

### Deployment, Docker, and environment

### 77. Railway uses the wrong start command

The intended command is `node Distribution/Discord/index.js`. A stale service
command such as `npm test`, a worker entry point, or an old file can start a
healthy-looking process that is not the current bot.

### 78. Railway builds from the wrong Docker context

The Dockerfile must copy the current repository and install the current
dependencies. Check the build log and deployed image commit, not just the local
working tree.

### 79. `DISCORD_TOKEN` is missing in Railway

`index.js` logs a fatal startup message and exits after two seconds. This is
distinct from a healthy `READY` log, but can be masked by repeated restarts.

### 80. `DISCORD_CLIENT_ID` is missing or stale

Runtime validation requires it, while `botConfig.js` falls back to an empty
string. Deployment command registration and runtime must use the same value.

### 81. `DISCORD_GUILD_ID` is missing for guild registration

The bot can still log in if only the runtime needs the client ID, but
`deploy-commands.js` refuses guild registration without the guild ID.

### 82. Railway secrets exist under the wrong service

Railway variables are service-specific. A token attached to a database or
worker service does not reach the bot service.

### 83. Railway variables were changed without a new deployment

Environment changes may require a restart or redeploy. Verify the new startup
timestamp and identity log after changing variables.

### 84. `NODE_ENV` changes dependency or config behavior

The repository expects Node 20 and production Docker behavior. A different
runtime or install mode can change module loading, Chromium, or network
behavior.

### 85. Node version is below the package requirement

`package.json` requires Node `>=20.0.0`. Older Node versions can fail on ESM,
Discord.js, or the Transformers.js dependency.

### 86. Dependency installation is incomplete

Missing `discord.js`, a transitive dependency, or a lockfile mismatch can stop
dynamic imports before commands load. The startup log should show a clear
fatal error.

### 87. Docker image contains stale `node_modules`

An old layer can preserve a different Discord.js version or source module.
Force a clean Railway build when the source and runtime behavior disagree.

### 88. The container binds the health server but not the intended process

`healthServer.listen()` runs before `client.login()`. A port-open signal only
proves the HTTP server started; it does not prove the Discord bot is alive.

### 89. Railway autoscaling creates multiple bot replicas

Discord gateway bots should run as one persistent process. Multiple replicas
can compete for the same token and make event delivery nondeterministic.

### 90. Replit and Railway are being treated as one deployment

`.replit` publishing settings affect Replit only. `railway.toml`, Railway
variables, and the Railway GitHub connection affect Railway. A successful
Replit workflow is not evidence that Railway updated.

### 91. Railway is configured as a web service with an unsuitable health check

This bot exposes HTTP only to satisfy platform health checks; Discord is its
actual service. A health-check rule that kills or replaces the process can
interrupt the gateway.

### 92. The service is sleeping or being suspended

An always-on Discord gateway process cannot depend on request-driven startup.
Confirm the Railway service remains running continuously between commands.

### 93. The service starts multiple copies through process managers

Do not combine Railway's start command with an internal supervisor, `pm2`,
`nodemon`, or a second `npm start`. One process should own the token.

### 94. Graceful shutdown is triggered by deployment replacement

The signal handler logs RSS and exits immediately. A command sent during that
window has no process available to acknowledge it.

### 95. A deployment rollback restored old interaction code

The container may have a healthy `READY` line from a previous release. Compare
release ID and source commit with the expected centralized acknowledgement and
raw probe.

### 96. Railway's log view is incomplete or delayed

The absence of a line in a truncated or stale UI view is not proof of no event.
Download the complete runtime log around the exact interaction timestamp.

### 97. Time zones make log correlation appear wrong

Discord, Railway, and local logs may display different time zones. Use the
interaction ID and a narrow timestamp window rather than comparing clock text
alone.

### 98. The deployment is private or the preview URL is unrelated

The HTTP status page URL is not a Discord gateway endpoint. Opening it or
seeing it online cannot confirm slash-command delivery.

### 99. A source file was changed locally but not committed

The lazy-loading and gateway-probe changes required commits before Railway
could see them. Always compare `git ls-remote origin` with the active Railway
release.

### 100. A commit was pushed to GitHub but Railway's trigger failed

GitHub can contain the commit while Railway remains on an older release.
Inspect Railway's deployment history and manually redeploy the correct commit
if the hook did not fire.

### Command-specific repository failures

### 101. `/status` cannot render its embed

`Coordinator/actions/status.js` returns an embed with uptime, guild count,
memory, and placeholder sync fields. If embed formatting rejects one field,
the command can acknowledge and then fail in the dispatcher.

### 102. `/status` receives no client object in an older build

The current handler passes `client` as a third argument and the coordinator
uses `client.guilds.cache.size`. A stale event file may pass only two
arguments.

### 103. `/ask` uses the wrong required option name

The registered option is `question`; `ask.js` calls
`getString('question', true)`. A stale command schema using `query` causes
option extraction to throw.

### 104. `/ai` uses a stale subcommand schema

The handler expects `explain`, `search`, `docs`, `glossary`, `message`, or
`live`. A live command with an older or different subcommand can fail in
`getSubcommand()` or the switch.

### 105. `/ai message` lacks conditionally required values

The schema requires only `type`, while the coordinator may require
`trainer_name`, `milestone_value`, `achievement_name`, or event fields for
specific message types. This can produce a business-level error after defer.

### 106. `/ai` loads the model on the first request

This is intentional after the memory change. It lowers startup memory but
increases first-AI latency. It should not affect `/status`, `/help`, or other
non-AI commands.

### 107. A data command has no configured circle

`CONFIGURED_CIRCLES` is currently an empty array. Commands that require a
primary or configured circle can return an application error or empty result.
This should not cause a raw command timeout if the dispatcher works.

### 108. Member resolution cannot find the Discord member

Profile, fan, join-date, link, and leaderboard paths depend on guild/member
data and external Uma.moe records. A missing mapping can fail after
acknowledgement.

### 109. External Uma.moe requests exceed their timeout

Data commands may wait on the external API. The centralized defer protects the
initial response, but no global command deadline guarantees a later edit.

### 110. External API response shape changed

Coordinator actions and pipeline utilities may assume known Uma.moe or GameTora
fields. A changed response can throw during formatting or image generation.

### 111. Puppeteer cannot start Chromium

Image commands such as milestone or timeline rendering use Puppeteer. The
Dockerfile installs system Chromium, but an incorrect executable path or
missing library can fail only those commands.

### 112. Image generation exceeds Discord attachment limits

Puppeteer can produce a valid PNG that is too large or malformed for Discord.
The command is acknowledged, but `send()` fails while uploading it.

### 113. Admin permission checks reject the caller

Admin handlers perform their own validation before coordinator work. Their
legacy `reply()` paths rely on the acknowledgement proxy; a stale build can
double-acknowledge.

### 114. Warning settings receives an invalid key/value

`warningsettings` has a nested subcommand schema. Invalid combinations can
return validation replies or throw in the coordinator.

### 115. Timeline channel resolution fails

`timeline_setup` accepts a channel name or mention. A missing channel,
inaccessible channel, or malformed mention can cause the command to fail after
defer.

### 116. A database or in-memory backend is unavailable

Several actions use repository storage or fallback state. A backend error
should become an error envelope, but a hanging connection can leave a deferred
interaction with no final response.

### 117. Scheduled operation work competes with command work

The ready event immediately starts the operation task and runs a health cycle.
If a future task consumes CPU, memory, or event-loop time, command completion
can be delayed.

### 118. A command response exceeds Discord's 2,000-character content limit

AI and text-producing commands use a 2,000-character constant in the local AI
service, but every coordinator path needs its own output limit. Oversized
responses fail during dispatch.

### 119. Embed field values exceed Discord limits

Leaderboards, member lists, profiles, and status embeds can exceed per-field,
per-embed, or total embed limits even if the text is otherwise valid.

### 120. Concurrent commands race on shared mutable state

Caches, scheduler state, in-memory databases, or model loading can be accessed
by multiple interactions at once. The first AI model load is shared, but
command-specific state may still race.

## Recommended investigation order

1. Deploy the current GitHub `main` commit containing the raw gateway probe.
2. Confirm Railway is running that exact commit and exactly one bot process.
3. Confirm the `READY` identity is `UmaKraftCircleBot#8905`.
4. Confirm the command belongs to application
   `1526549146788429894` and guild `1489093959044173935`.
5. Run one fresh `/status` and record its interaction ID and timestamp.
6. Search the complete Railway log for:

   ```text
   [discord/raw] interactionCreate received /status
   [interactionCreate] Received /status
   [interactionCreate] Completed /status
   Unhandled error
   Dispatch also failed
   Discord API error
   Interaction expired
   ```

7. If there is no raw probe, stop debugging handlers and fix deployment,
   installation, token/application identity, guild, or duplicate-process state.
8. If the raw probe appears, continue through the handler and dispatcher
   branches using the interpretation table above.
9. Test `/status` before `/ask` or `/ai`; this isolates Discord and response
   delivery from lazy model loading.
10. Only after `/status` works should AI model latency and memory be tested.

## Bottom line

The repository currently has enough centralized logging to locate the failure,
but only if the live Railway process is running the newest source. Based on the
available logs, the highest-probability problem is not “the command handler is
bad”; it is that the interaction is not reaching this particular gateway
process. The raw gateway probe, exact Railway commit verification, and
application/guild identity check are the shortest path to the real root cause.