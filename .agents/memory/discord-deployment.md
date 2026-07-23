---
name: Discord deployment
description: Deployment requirements for the persistent UmaKraft Discord gateway bot.
---

## Rule
The Discord bot must be published as an always-on VM using `node Distribution/Discord/index.js`; autoscale/cloudrun is not suitable for the persistent gateway connection.

**Why:** The published deployment was autoscale with no successful current build while Discord interactions timed out. A gateway bot needs a continuously running process, not a request-driven service.

**How to apply:** After changing the deployment target or bot code, republish and confirm the deployment reports a successful build before testing slash commands.

**Separate Railway deployment:** Railway uses `railway.toml` and its own deployment lifecycle; changing Replit's Publishing configuration does not update Railway. Always verify the Railway deployment commit and logs separately when Discord is pointed at Railway.