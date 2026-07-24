/**
 * core/botConfig.js
 * Non-sensitive deployment configuration.
 *
 * Edit the values below to match your Discord application and deployment.
 * None of these are secrets — do not put API keys here.
 * API keys belong in Railway Variables / Replit Secrets.
 */

// ── Discord application identifiers ──────────────────────────────────────────
// Found in Discord Developer Portal → Your Application → General Information.
export const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';   // Application (Client) ID
export const DISCORD_GUILD_ID  = process.env.DISCORD_GUILD_ID || '';   // Your Discord server (Guild) ID

// ── Broadcast pipeline ────────────────────────────────────────────────────────
// IDs of the circles the Broadcast pipeline should process.
// Override at deploy time via the CONFIGURED_CIRCLES env var (comma-separated).
// Can also be set at runtime via broker.setConfiguredCircles().
export const CONFIGURED_CIRCLES = process.env.CONFIGURED_CIRCLES
  ? process.env.CONFIGURED_CIRCLES.split(',').map(s => s.trim()).filter(Boolean)
  : ['974470619'];

// ── Operations channel ────────────────────────────────────────────────────────
// Discord channel ID for ops / alert messages from the Announcer.
// Set to null to disable (alerts are logged to console only).
export const OPS_CHANNEL_ID = null;
