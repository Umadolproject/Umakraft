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
// Discord channel ID for ops / alert messages from the Announcer and Railway
// deployment/log notifications. Keep empty to disable.
export const OPS_CHANNEL_ID = process.env.OPS_CHANNEL_ID || '';

// ── Announcement channel ─────────────────────────────────────────────────────
// Discord channel ID for bot announcements (fan deficit, moderation, milestones).
// Set via ANNOUNCEMENT_CHANNEL_ID environment variable / secret.
export const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID || '';

// Webhook URL for announcement cross-posting (optional, falls back to channel send).
// Set via ANNOUNCEMENT_WEBHOOK_URL environment variable / secret.
export const ANNOUNCEMENT_WEBHOOK_URL = process.env.ANNOUNCEMENT_WEBHOOK_URL || '';

// ── Message channel ───────────────────────────────────────────────────────────
// Discord channel ID for community messages (greetings, milestones, leaderboards,
// achievements). These are the positive, celebratory bot notifications.
// Set via MESSAGE_CHANNEL_ID environment variable / secret.
export const MESSAGE_CHANNEL_ID = process.env.MESSAGE_CHANNEL_ID || '';

// Webhook URL for message cross-posting (optional, falls back to channel send).
// Set via MESSAGE_WEBHOOK_URL environment variable / secret.
export const MESSAGE_WEBHOOK_URL = process.env.MESSAGE_WEBHOOK_URL || '';

// ── Chat channel ──────────────────────────────────────────────────────────────
// Discord channel ID for @mention Q&A — users mention the bot here and the AI
// responds to qualified questions via the messageCreate handler.
// Set via CHAT_CHANNEL_ID environment variable / secret.
export const CHAT_CHANNEL_ID = process.env.CHAT_CHANNEL_ID || '';

// Webhook URL for posting to #bot-chat (e.g. proactive bot messages, AI responses).
// Set via CHAT_WEBHOOK_URL environment variable / secret.
export const CHAT_WEBHOOK_URL = process.env.CHAT_WEBHOOK_URL || '';

// Railway webhook and log-drain authentication. These are secrets and must
// only be configured as Railway/Replit environment secrets.
export const RAILWAY_WEBHOOK_SECRET = process.env.RAILWAY_WEBHOOK_SECRET || '';
export const RAILWAY_LOG_DRAIN_SECRET = process.env.RAILWAY_LOG_DRAIN_SECRET || '';
