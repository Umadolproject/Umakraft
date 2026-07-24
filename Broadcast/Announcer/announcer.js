/**
 * Announcer
 * Phase 4: DM user cache (TTL-based) + text-only notification support.
 */

import * as archive from '../Archive/archive.js';
import { OPS_CHANNEL_ID } from '../../core/botConfig.js';
import { pipelineRuntime } from '../../core/pipelineRuntime.js';
import { createLogger } from '../../core/pipelineLogger.js';

const logger = createLogger('announcer');

// ─── DM user cache (Phase 4) ──────────────────────────────────────────────────
// Caches fetched Discord User objects so rapid DM bursts (e.g. large circles)
// don't hit the Discord REST API once per recipient per step.

const _userCache    = new Map(); // userId -> { user, expiresAt }
const USER_CACHE_TTL_MS = Number.parseInt(
  process.env.ANNOUNCER_USER_CACHE_TTL_MS ?? String(5 * 60 * 1000),
  10,
);

async function _fetchUser(client, userId) {
  const cached = _userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  const user = await client.users.fetch(userId);
  _userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  return user;
}

export function clearUserCache() {
  _userCache.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFabricator() {
  const mod = await import('../../Workshop/Fabricator/fabricator.js');
  return mod;
}

async function _dmUser(client, userId, messageOpts) {
  const user = await _fetchUser(client, userId);
  const dm   = await user.createDM();
  return dm.send(messageOpts);
}

function _buildFilename(type) {
  const safe = (type ?? 'notification').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safe}_card.png`;
}

function _toAttachment(buf, filename) {
  return { attachment: buf, name: filename };
}

/**
 * Attempt to render a card via Fabricator.
 * Returns null if imageParams is absent (text-only notification) or Fabricator fails.
 * Phase 4: missing imageParams is a normal, non-error path.
 */
async function _renderCard(record) {
  if (!record.payload?.imageParams) return null;   // text-only — expected path
  try {
    const fabricator = await getFabricator();
    const result = await fabricator.fabricate(record.payload.imageParams);
    if (!result?.success || !result.buffer) {
      logger.warn('Fabricator did not return a buffer', { notificationKey: record.notificationKey });
      return null;
    }
    return result.buffer;
  } catch (err) {
    logger.warn(`Fabricator threw: ${err.message}`, { notificationKey: record.notificationKey });
    return null;
  }
}

// ─── Dead-letter threshold ────────────────────────────────────────────────────

async function _checkDeadLetterThreshold(notificationKey, step, reason) {
  const summary = await archive.getAttemptSummary(notificationKey);
  if (!summary?.success) return false;
  if (summary.failureCount < pipelineRuntime.broadcastMaxDeliveryAttempts) return false;

  await archive.markDeadLetter(notificationKey, {
    step,
    reason,
    attemptCount: summary.failureCount,
  });
  logger.error('notification moved to dead-letter', {
    notificationKey,
    step,
    reason,
    attemptCount: summary.failureCount,
  });
  return true;
}

// ─── Delivery steps ───────────────────────────────────────────────────────────

export async function _postChannel(record, cardBuffer, client) {
  const { notificationKey, type, recipients, payload } = record;
  const channels = recipients?.channels ?? [];

  if (channels.length === 0) {
    logger.info('no channels configured — skipping channel step', { notificationKey });
    await archive.markChannelSent(notificationKey, {});
    await archive.recordHistory(notificationKey, { step: 'channel', outcome: 'success', detail: 'no channels configured' });
    return { success: true };
  }

  const errors = [];
  let lastSuccess = null;

  for (const channelId of channels) {
    try {
      const ch = await client.channels.fetch(channelId);
      const messageOpts = { content: payload?.message ?? undefined };
      if (cardBuffer) messageOpts.files = [_toAttachment(cardBuffer, _buildFilename(type))];
      const msg = await ch.send(messageOpts);
      logger.info('channel posted', { notificationKey, channelId, messageId: msg.id });
      lastSuccess = { channelMsgId: msg.id, channelId: ch.id, guildId: ch.guildId ?? null };
    } catch (err) {
      const discordCode = err.code ?? null;
      logger.error(`channel post failed: ${err.message}`, { notificationKey, channelId, discordCode });
      await archive.recordHistory(notificationKey, {
        step: 'channel',
        outcome: 'failure',
        discordCode,
        detail: err.message,
      });
      errors.push({ channelId, error: err.message, discordCode });
    }
  }

  if (errors.length > 0) return { success: false, errors };

  await archive.markChannelSent(notificationKey, lastSuccess ?? {});
  await archive.recordHistory(notificationKey, { step: 'channel', outcome: 'success' });
  return { success: true };
}

export async function _sendMemberDms(record, cardBuffer, client) {
  const { notificationKey, type, recipients, payload } = record;
  const memberDms = recipients?.memberDms ?? [];

  if (memberDms.length === 0) {
    logger.info('no member DMs configured — skipping member DM step', { notificationKey });
    await archive.markDmMemberSent(notificationKey);
    await archive.recordHistory(notificationKey, { step: 'dm_member', outcome: 'success', detail: 'no recipients' });
    return { success: true };
  }

  // NOTE: rebuild messageOpts (and re-wrap the buffer as an attachment) inside
  // the loop so each DM gets a fresh stream — discord.js consumes the underlying
  // buffer on send and re-using the same options object can produce empty
  // attachments for the 2nd+ recipient.
  const errors = [];
  for (const userId of memberDms) {
    const messageOpts = { content: payload?.message ?? undefined };
    if (cardBuffer) messageOpts.files = [_toAttachment(cardBuffer, _buildFilename(type))];
    try {
      await _dmUser(client, userId, messageOpts);
      logger.info('member DM sent', { notificationKey, userId });
    } catch (err) {
      const discordCode = err.code ?? null;
      logger.error(`member DM failed: ${err.message}`, { notificationKey, userId, discordCode });
      errors.push({ userId, error: err.message, discordCode });
    }
  }

  if (errors.length > 0) {
    for (const error of errors) {
      await archive.recordHistory(notificationKey, {
        step: 'dm_member',
        outcome: 'failure',
        discordCode: error.discordCode,
        detail: `userId=${error.userId}: ${error.error}`,
      });
    }
    return { success: false, errors };
  }

  await archive.markDmMemberSent(notificationKey);
  await archive.recordHistory(notificationKey, { step: 'dm_member', outcome: 'success' });
  return { success: true };
}

export async function _sendLeaderDm(record, cardBuffer, client) {
  const { notificationKey, type, recipients, payload } = record;
  const leaderDm = recipients?.leaderDm;

  if (!leaderDm) {
    logger.info('no leader DM configured — skipping leader DM step', { notificationKey });
    await archive.markDmLeaderSent(notificationKey);
    await archive.recordHistory(notificationKey, { step: 'dm_leader', outcome: 'success', detail: 'no leader configured' });
    return { success: true };
  }

  const messageOpts = { content: payload?.message ?? undefined };
  if (cardBuffer) messageOpts.files = [_toAttachment(cardBuffer, _buildFilename(type))];

  try {
    await _dmUser(client, leaderDm, messageOpts);
    await archive.markDmLeaderSent(notificationKey);
    await archive.recordHistory(notificationKey, { step: 'dm_leader', outcome: 'success' });
    logger.info('leader DM sent', { notificationKey, leaderId: leaderDm });
    return { success: true };
  } catch (err) {
    const discordCode = err.code ?? null;
    logger.error(`leader DM failed: ${err.message}`, { notificationKey, leaderId: leaderDm, discordCode });
    await archive.recordHistory(notificationKey, {
      step: 'dm_leader',
      outcome: 'failure',
      discordCode,
      detail: err.message,
    });
    return { success: false, error: err.message };
  }
}

// ─── Main delivery ────────────────────────────────────────────────────────────

export async function deliver(record, client) {
  if (!record?.notificationKey) {
    logger.error('ANNOUNCER_MISSING_RECORD: deliver() called without a valid record');
    return;
  }

  const notificationKey = record.notificationKey;
  logger.info('delivery start', { notificationKey, type: record.type });

  // Phase 4: _renderCard returns null gracefully for text-only notifications
  const cardBuffer = client ? await _renderCard(record) : null;

  if (record.channelSent === 0) {
    if (!client) {
      logger.warn('no Discord client — skipping channel step', { notificationKey });
    } else {
      const result = await _postChannel(record, cardBuffer, client);
      if (!result.success) {
        const deadLettered = await _checkDeadLetterThreshold(notificationKey, 'channel', 'channel delivery failed repeatedly');
        logger.warn(deadLettered ? 'channel step dead-lettered' : 'channel step failed — will retry', { notificationKey });
        return;
      }
      record = { ...record, channelSent: 1 };
    }
  } else {
    logger.info('channel step already done — skipping', { notificationKey });
  }

  if (record.dmMemberSent === 0) {
    if (!client) {
      logger.warn('no Discord client — skipping member DM step', { notificationKey });
    } else {
      const result = await _sendMemberDms(record, cardBuffer, client);
      if (!result.success) {
        const deadLettered = await _checkDeadLetterThreshold(notificationKey, 'dm_member', 'member DM delivery failed repeatedly');
        logger.warn(deadLettered ? 'member DM step dead-lettered' : 'member DM step failed — will retry', { notificationKey });
        return;
      }
      record = { ...record, dmMemberSent: 1 };
    }
  } else {
    logger.info('member DM step already done — skipping', { notificationKey });
  }

  if (record.dmLeaderSent === 0) {
    if (!client) {
      logger.warn('no Discord client — skipping leader DM step', { notificationKey });
    } else {
      const result = await _sendLeaderDm(record, cardBuffer, client);
      if (!result.success) {
        const deadLettered = await _checkDeadLetterThreshold(notificationKey, 'dm_leader', 'leader DM delivery failed repeatedly');
        logger.warn(deadLettered ? 'leader DM step dead-lettered' : 'leader DM step failed — will retry', { notificationKey });
        return;
      }
    }
  } else {
    logger.info('leader DM step already done — skipping', { notificationKey });
  }

  logger.info('delivery complete', { notificationKey });
}

// ─── Operation alert ──────────────────────────────────────────────────────────

export async function announceOperationAlert({ decision, summary, affectedSubjects, decidedAt }, client) {
  logger.warn('OPERATION_ALERT', { decision, affectedSubjects, summary });

  if (!client) {
    logger.warn('announceOperationAlert: no Discord client — alert logged only');
    return;
  }
  if (!OPS_CHANNEL_ID) {
    logger.warn('announceOperationAlert: OPS_CHANNEL_ID not configured — alert logged only');
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
    logger.info('operation alert posted', { decision });
  } catch (err) {
    logger.error(`failed to post operation alert: ${err.message}`, { decision });
  }
}
