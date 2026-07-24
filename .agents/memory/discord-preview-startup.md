---
name: Discord preview startup
description: Startup behavior when the Discord bot token is unavailable in Replit preview.
---

## Rule
The Discord entry point should keep its health and preview server available when `DISCORD_TOKEN` is absent, while skipping gateway login and reporting that Discord is not configured. When a token is present, normal client startup remains strict.

**Why:** Replit preview and health checks need a long-running HTTP process even when a Discord secret has not been attached yet. Exiting immediately makes the artifact appear broken and hides the actual configuration requirement.

**How to apply:** Treat `DISCORD_TOKEN` as the switch for gateway startup, not for HTTP preview startup. Keep `/health` machine-readable, show the same state on `/`, and return a successful no-content response for `/favicon.ico` to keep browser logs clean.