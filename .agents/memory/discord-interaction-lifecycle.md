---
name: Discord interaction lifecycle
description: Rules for acknowledging and completing slash-command interactions safely.
---

## Rule
Every slash command must be acknowledged at the Discord boundary before validation, AI inference, image rendering, or data access. Legacy handlers that call `reply()` or `deferReply()` must not be allowed to control the acknowledgement state independently.

**Why:** Inconsistent handlers caused both AI and non-AI commands to expire or fail after acknowledgement. Some handlers replied before deferring, and a compatibility response was accidentally passed to the dispatcher as an envelope.

**How to apply:** Keep the central interaction wrapper responsible for the initial defer, including unknown-command paths. Handler visibility metadata may choose ephemeral/public output, but handler `defer` flags are legacy metadata only. If a compatibility layer is used, bind Discord methods to the original interaction and convert validation replies into an explicit handled-response marker. Always dispatch envelopes with the original interaction object.