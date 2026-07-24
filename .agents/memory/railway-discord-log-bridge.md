---
name: Railway Discord log bridge
description: Railway deployment and runtime logs are forwarded through authenticated HTTP endpoints and batched into the configured Discord operations channel.
---

## Rule
Keep Railway deployment notifications and runtime log forwarding behind separate secrets and endpoints. Redact common credential patterns and batch runtime lines before sending to Discord; Railway remains the complete log source.

**Why:** Railway deployment events can arrive before the bot process is healthy, while runtime drains can be high-volume. Separating the channels avoids a startup dependency loop and prevents Discord flooding or accidental secret disclosure.

**How to apply:** Configure the Railway project webhook and log drain externally after a public service domain exists. Store `RAILWAY_WEBHOOK_SECRET` and `RAILWAY_LOG_DRAIN_SECRET` only as deployment secrets, and route both to the operations channel configured for the bot.