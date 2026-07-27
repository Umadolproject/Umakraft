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
export const ANNOUNCEMENT_CHANNEL_ID = process.env.ANNOUNCEMENT_CHANNEL_ID || '1530929079551791124';

// Webhook URL for announcement cross-posting (optional, falls back to channel send).
export const ANNOUNCEMENT_WEBHOOK_URL = process.env.ANNOUNCEMENT_WEBHOOK_URL || 'https://discord.com/api/webhooks/1531199299713503342/FgumW3O2bU9dmOVn3L-hH_6pRQ9sAWkGaNuQgQlrxB_vZrauFidJ0hacsQdj2frOpRKv';

// ── Message channel ───────────────────────────────────────────────────────────
// Discord channel ID for community messages (greetings, milestones, leaderboards,
// achievements). These are the positive, celebratory bot notifications.
export const MESSAGE_CHANNEL_ID = process.env.MESSAGE_CHANNEL_ID || '1531139811421978786';

// Webhook URL for message cross-posting (optional, falls back to channel send).
export const MESSAGE_WEBHOOK_URL = process.env.MESSAGE_WEBHOOK_URL || 'https://discord.com/api/webhooks/1531204407415275530/kSlnDyklhlZgbG7PtajJxWAFehBV4V69Lra3d9gp4bEGa7J_Prba37vPeCcZZZnWfD1i';

// ── Chat channel ──────────────────────────────────────────────────────────────
// Discord channel ID for @mention Q&A — users mention the bot here and the AI
// responds to qualified questions via the messageCreate handler.
export const CHAT_CHANNEL_ID = process.env.CHAT_CHANNEL_ID || '1531205995009671201';

// Webhook URL for posting to #bot-chat (e.g. proactive bot messages, AI responses).
export const CHAT_WEBHOOK_URL = process.env.CHAT_WEBHOOK_URL || 'https://discord.com/api/webhooks/1531208382239740127/u9ROij-q1bEnTtSbLaOjQGp7xCnWFDbSgWIhnUIGCXSHTPvEfjJRdmrKlW8X_iKOdaTv';

// Railway webhook and log-drain authentication. These are secrets and must
// only be configured as Railway/Replit environment secrets.
export const RAILWAY_WEBHOOK_SECRET = process.env.RAILWAY_WEBHOOK_SECRET || '';
export const RAILWAY_LOG_DRAIN_SECRET = process.env.RAILWAY_LOG_DRAIN_SECRET || '';
