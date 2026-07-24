---
name: Discord interaction lifecycle
description: Rules for acknowledging and completing slash-command interactions safely.
---

## Rule
Every slash command must be acknowledged at the Discord boundary before validation, AI inference, image rendering, or data access. Legacy handlers that call `reply()` or `deferReply()` must not be allowed to control the acknowledgement state independently.

**Why:** Inconsistent handlers caused both AI and non-AI commands to expire or fail after acknowledgement. Some handlers replied before deferring, and a compatibility response was accidentally passed to the dispatcher as an envelope.

**How to apply:** Keep the central interaction wrapper responsible for the initial defer, including unknown-command paths. Handler visibility metadata may choose ephemeral/public output, but handler `defer` flags are legacy metadata only. If a compatibility layer is used, bind Discord methods to the original interaction and convert validation replies into an explicit handled-response marker. Always dispatch envelopes with the original interaction object.

## Version note
With the installed `discord.js` 14.27.x, the gateway-ready event is `clientReady`; using `clientReady` in the entry point and ready handler is correct. The older `ready` name is deprecated in this version.

**Why:** A static audit incorrectly treated `clientReady` as a mismatch with `ready`, but the installed library explicitly defines and emits `clientReady`. Changing it would break readiness handling rather than fix commands.

**How to apply:** Verify event names against the installed Discord.js major version before diagnosing command delivery. Treat readiness status and interaction dispatch as separate paths.