/**
 * Announcer
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Announcer — Stage 5, Broadcast
 * Version:   v2.0.0
 *
 * The delivery engine of the Broadcast pipeline.
 *
 * Receives a fully-loaded notification record from Archive-Transporter and
 * executes the delivery plan step by step:
 *   1. Check each flag — if already 1, skip
 *   2. Render image card via Workshop/Fabricator
 *   3. Post to Discord channel(s)
 *   4. Send member DMs
 *   5. Send leader DM
 *   6. Update each flag in Archive on success; record history on each attempt
 *
 * Announcer never reads from Archive at the start of delivery — the full record
 * arrives pre-fetched from Archive-Transporter. It only writes back to Archive
 * (flag updates + history rows).
 *
 * If a step fails, Announcer leaves the flag at 0 and returns. The next Broker
 * cron run will surface the incomplete record through Archive-Transporter for retry.
 *
 * Announcer also exposes announceOperationAlert() for fire-and-forget Operation
 * health alerts from Operation/Manager. These do not go through Archive.
 */

import * as archive from '../Archive/archive.js';
import { OPS_CHANNEL_ID } from '../../core/botConfig.js';

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'announcer',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

// ─── Fabricator — lazy import ─────────────────────────────────────────────────

async function getFabricator() {
  const mod = await import('../../Workshop/Fabricator/fabricator.js');
  return mod;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a Discord user and send them a DM with an embed + optional attachment.
 *
 * @param {object} client       — Discord.js Client
 * @param {string} userId       — Discord user snowflake
 * @param {object} messageOpts  — { embeds?, files? }
 */
async function _dmUser(client, userId, messageOpts) {
  const user = await client.users.fetch(userId);
  const dm   = await user.createDM();
  return dm.send(messageOpts);
}

/**
 * Build a filename for the card attachment based on notification type.
 *
 * @param {string} type
 * @returns {string}
 */
function _buildFilename(type) {
  const safe = (type ?? 'notification').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}_card.png`;
}

/**
 * Wrap a Buffer as a Discord.js AttachmentBuilder-compatible object.
 * We use a plain object here so Announcer has no hard dependency on discord.js at
 * module load time — the object is only used at delivery time when the client is live.
 *
 * @param {Buffer} buf
 * @param {string} filename
 */
function _toAttachment(buf, filename) {
  try {
    // Prefer AttachmentBuilder (discord.js ≥ 14)
    const { AttachmentBuilder } = require('discord.js'); // eslint-disable-line
    return new AttachmentBuilder(buf, { name: filename });
  } catch {
    // Fallback: return a plain object that discord.js accepts as a file upload
    return { attachment: buf, name: filename };
  }
}

// ─── Delivery steps ───────────────────────────────────────────────────────────

/**
 * Step 1+2: Render card via Fabricator.
 *
 * @param {object} record
 * @returns {Promise<Buffer|null>}
 */
async function _renderCard(record) {
  try {
    const fabricator = await getFabricator();
    const result = await fabricator.fabricate(record.payload.imageParams);
    if (!result?.success || !result.buffer) {
      log('warn', `Fabricator did not return a buffer for key=${record.notificationKey}`);
      return null;
    }
    return result.buffer;
  } catch (err) {
    log('warn', `Fabricator threw for key=${record.notificationKey}: ${err.message}`);
    return null;
  }
}

/**
 * Step 2: Post to each configured Discord channel.
 *
 * @param {object} record
 * @param {Buffer|null} cardBuffer
 * @param {object} client
 */
export async function _postChannel(record, cardBuffer, client) {
  const { notificationKey, type, recipients, payload } = record;
  const channels = recipients?.channels ?? [];

  if (channels.length === 0) {
    log('info', `no channels configured for key=${notificationKey} — skipping channel step`);
    await archive.markChannelSent(notificationKey, {});
    await archive.recordHistory(notificationKey, { step: 'channel', outcome: 'success', detail: 'no channels configured' });
    return { success: true };
  }

  // Attempt every configured channel. Collect failures — if any channel fails
  // the entire step is treated as failed and channelSent stays at 0.
  // All channels are attempted regardless of individual failures so a broken
  // channel ID never silently blocks the others from receiving the message.
  const errors = [];
  let lastSuccess = null; // { msgId, channelId, guildId } from the final successful send

  for (const channelId of channels) {
    try {
      const ch = await client.channels.fetch(channelId);
      const messageOpts = { content: payload?.message ?? undefined };
      if (cardBuffer) {
        messageOpts.files = [_toAttachment(cardBuffer, _buildFilename(type))];
      }
      const msg = await ch.send(messageOpts);
      log('info', `channel posted key=${notificationKey} channelId=${channelId} msgId=${msg.id}`);
      lastSuccess = { channelMsgId: msg.id, channelId: ch.id, guildId: ch.guildId ?? null };
    } catch (err) {
      const discordCode = err.code ?? null;
      log('error', `channel post failed key=${notificationKey} channelId=${channelId}: ${err.message}`, { discordCode });
      await archive.recordHistory(notificationKey, {
        step:        'channel',
        outcome:     'failure',
        discordCode,
        detail:      err.message,
      });
      errors.push({ channelId, error: err.message, discordCode });
    }
  }

  if (errors.length > 0) {
    // At least one channel failed — leave channelSent=0 so Broker retries the step
    return { success: false, errors };
  }

  // All channels posted successfully
  await archive.markChannelSent(notificationKey, lastSuccess ?? {});
  await archive.recordHistory(notificationKey, { step: 'channel', outcome: 'success' });
  return { success: true };
}

/**
 * Step 3: Send DM to each member in recipients.memberDms.
 *
 * @param {object} record
 * @param {Buffer|null} cardBuffer
 * @param {object} client
 */
export async function _sendMemberDms(record, cardBuffer, client) {
  const { notificationKey, type, recipients, payload } = record;
  const memberDms = recipients?.memberDms ?? [];

  if (memberDms.length === 0) {
    log('info', `no memberDms configured for key=${notificationKey} — skipping member DM step`);
    await archive.markDmMemberSent(notificationKey);
    await archive.recordHistory(notificationKey, { step: 'dm_member', outcome: 'success', detail: 'no recipients' });
    return { success: true };
  }

  const messageOpts = { content: payload?.message ?? undefined };
  if (cardBuffer) {
    messageOpts.files = [_toAttachment(cardBuffer, _buildFilename(type))];
  }

  const errors = [];
  for (const userId of memberDms) {
    try {
      await _dmUser(client, userId, messageOpts);
      log('info', `member DM sent key=${notificationKey} userId=${userId}`);
    } catch (err) {
      const discordCode = err.code ?? null;
      log('error', `member DM failed key=${notificationKey} userId=${userId}: ${err.message}`, { discordCode });
      errors.push({ userId, error: err.message, discordCode });
    }
  }

  if (errors.length > 0) {
    // Partial failures — record each failure but leave the flag at 0 so the
    // entire step is retried on the next run. This is intentionally conservative.
    for (const e of errors) {
      await archive.recordHistory(notificationKey, {
        step:        'dm_member',
        outcome:     'failure',
        discordCode: e.discordCode,
        detail:      `userId=${e.userId}: ${e.error}`,
      });
    }
    return { success: false, errors };
  }

  await archive.markDmMemberSent(notificationKey);
  await archive.recordHistory(notificationKey, { step: 'dm_member', outcome: 'success' });
  return { success: true };
}

/**
 * Step 4: Send DM to the configured circle leader.
 *
 * @param {object} record
 * @param {Buffer|null} cardBuffer
 * @param {object} client
 */
export async function _sendLeaderDm(record, cardBuffer, client) {
  const { notificationKey, type, recipients, payload } = record;
  const leaderDm = recipients?.leaderDm;

  if (!leaderDm) {
    log('info', `no leaderDm configured for key=${notificationKey} — skipping leader DM step`);
    await archive.markDmLeaderSent(notificationKey);
    await archive.recordHistory(notificationKey, { step: 'dm_leader', outcome: 'success', detail: 'no leader configured' });
    return { success: true };
  }

  const messageOpts = { content: payload?.message ?? undefined };
  if (cardBuffer) {
    messageOpts.files = [_toAttachment(cardBuffer, _buildFilename(type))];
  }

  try {
    await _dmUser(client, leaderDm, messageOpts);
    await archive.markDmLeaderSent(notificationKey);
    await archive.recordHistory(notificationKey, { step: 'dm_leader', outcome: 'success' });
    log('info', `leader DM sent key=${notificationKey} leaderId=${leaderDm}`);
    return { success: true };
  } catch (err) {
    const discordCode = err.code ?? null;
    log('error', `leader DM failed key=${notificationKey} leaderId=${leaderDm}: ${err.message}`, { discordCode });
    await archive.recordHistory(notificationKey, {
      step:        'dm_leader',
      outcome:     'failure',
      discordCode,
      detail:      err.message,
    });
    return { success: false, error: err.message };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Deliver a notification. Called by Archive-Transporter (both new delivery and
 * restart-recovery retry). Receives the full pre-fetched record — does not read
 * Archive itself at the start.
 *
 * Steps always run in fixed order. Each step is skipped if its flag is already 1.
 *
 * @param {object} record   — full notification record from Archive-Transporter
 * @param {object|null} client — Discord.js Client (may be null in tests)
 */
export async function deliver(record, client) {
  if (!record?.notificationKey) {
    log('error', 'ANNOUNCER_MISSING_RECORD: deliver() called without a valid record');
    return;
  }

  const { notificationKey } = record;
  log('info', `delivery start key=${notificationKey} type=${record.type}`);

  // Render the card once; reuse across all steps
  let cardBuffer = null;
  if (record.payload?.imageParams && client) {
    cardBuffer = await _renderCard(record);
  }

  // ── Step: channel ──────────────────────────────────────────────────────────
  if (record.channelSent === 0) {
    if (!client) {
      log('warn', `no Discord client for key=${notificationKey} — skipping channel step`);
    } else {
      const result = await _postChannel(record, cardBuffer, client);
      if (!result.success) {
        log('warn', `channel step failed for key=${notificationKey} — leaving flag at 0, will retry`);
        return; // stop here; Broker will surface this record on next run
      }
      // Update local copy of the flag so subsequent steps see channelSent=1
      record = { ...record, channelSent: 1 };
    }
  } else {
    log('info', `channel step already done for key=${notificationKey} — skipping`);
  }

  // ── Step: member DMs ───────────────────────────────────────────────────────
  if (record.dmMemberSent === 0) {
    if (!client) {
      log('warn', `no Discord client for key=${notificationKey} — skipping member DM step`);
    } else {
      const result = await _sendMemberDms(record, cardBuffer, client);
      if (!result.success) {
        log('warn', `member DM step failed for key=${notificationKey} — leaving flag at 0, will retry`);
        return;
      }
      record = { ...record, dmMemberSent: 1 };
    }
  } else {
    log('info', `member DM step already done for key=${notificationKey} — skipping`);
  }

  // ── Step: leader DM ────────────────────────────────────────────────────────
  if (record.dmLeaderSent === 0) {
    if (!client) {
      log('warn', `no Discord client for key=${notificationKey} — skipping leader DM step`);
    } else {
      const result = await _sendLeaderDm(record, cardBuffer, client);
      if (!result.success) {
        log('warn', `leader DM step failed for key=${notificationKey} — leaving flag at 0, will retry`);
        return;
      }
    }
  } else {
    log('info', `leader DM step already done for key=${notificationKey} — skipping`);
  }

  log('info', `delivery complete key=${notificationKey}`);
}

/**
 * Deliver an Operation health alert to the configured ops channel.
 *
 * Called by Operation/Manager for Critical, Failed, and Investigation Required
 * decisions. Does not go through Archive — Operation alerts are fire-and-forget
 * with no dedup.
 *
 * @param {{ decision: string, summary: string, affectedSubjects: string[], decidedAt: Date }} alert
 * @param {object|null} client — Discord.js Client; if null, alert is only logged
 */
export async function announceOperationAlert({ decision, summary, affectedSubjects, decidedAt }, client) {
  log('warn', `OPERATION_ALERT decision=${decision} subjects=[${(affectedSubjects ?? []).join(', ')}] — ${summary}`);

  if (!client) {
    // No client available (e.g. during startup or tests) — log only
    log('warn', 'announceOperationAlert: no Discord client — alert logged only');
    return;
  }

  if (!OPS_CHANNEL_ID) {
    log('warn', 'announceOperationAlert: OPS_CHANNEL_ID not configured — alert logged only');
    return;
  }

  try {
    const ch = await client.channels.fetch(OPS_CHANNEL_ID);
    const ts = decidedAt instanceof Date ? decidedAt.toISOString() : (decidedAt ?? new Date().toISOString());
    const text = [
      `**[OPERATION ALERT] ${decision}**`,
      summary,
      affectedSubjects?.length ? `Affected: ${affectedSubjects.join(', ')}` : '',
      `At: ${ts}`,
    ].filter(Boolean).join('\n');

    await ch.send({ content: text });
    log('info', `operation alert posted decision=${decision}`);
  } catch (err) {
    log('error', `failed to post operation alert: ${err.message}`);
  }
}
