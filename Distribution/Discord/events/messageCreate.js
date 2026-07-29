// Distribution/Discord/events/messageCreate.js
// #bot-chat @mention handler — activates the UmaKraft AI when the bot is
// mentioned in the designated chat channel. Runs every message through the
// TopicFilter; qualified questions go to the AI pipeline; off-topic messages
// get a gentle, in-character decline.
//
// Channel: #bot-chat (1531205995009671201)
// Trigger: @UmaKraft <question>
//
// NOTE: @mentions now use the SAME full pipeline as /ask — coordinator.aiCommand()
// handles context building, prompt assembly, conversation memory, web search,
// multi-language detection, and LearningManager enrichment. No more local-only AI.

import { classify, offTopicMessage } from '../../../AI/TopicFilter.js';
import { coordinator } from '../../Coordinator/index.js';
import { createLogger } from '../../../core/pipelineLogger.js';
import { CHAT_CHANNEL_ID } from '../../../core/botConfig.js';
import { isPersonalStatsQuery, isComparisonQuery, isMultiComparison, isLeaderboardQuery, getStats, compareStats, compareMulti, getLeaderboard } from '../../../AI/personalStats.js';
import { hasPending, hasPendingCorrection, processReply, processCorrection, requestFeedback } from '../../../AI/FeedbackManager.js';
import {
  startSession, continueSession, endSession,
  isSessionActive, isExitMessage, cleanupSessions,
} from '../../../AI/AdvancedFeatures.js';

const logger = createLogger('messageCreate');

export const name = 'messageCreate';
export const once = false;

// ─── Configuration ──────────────────────────────────────────────────────────
const BOT_CHAT_CHANNEL_ID = CHAT_CHANNEL_ID;

// ─── The AI pipeline (aiService.answer) expects a Discord interaction object. ──
// We wrap the Message to look like an interaction so we can reuse the full
// pipeline without duplicating it.

function messageToInteraction(message) {
  const userId = message.author.id;
  let replied = false;

  return {
    id: message.id,
    user: message.author,
    guildId: message.guildId,
    channelId: message.channelId,
    userId,
    deferred: true,
    replied: false,
    ephemeral: false,

    reply: async (payload = {}) => {
      if (replied) {
        return message.reply({
          content: typeof payload === 'string' ? payload : payload.content,
          allowedMentions: { repliedUser: true },
        });
      }
      replied = true;
      return message.reply({
        content: typeof payload === 'string' ? payload : payload.content,
        allowedMentions: { repliedUser: true },
      });
    },

    deferReply: async () => { /* no-op — we use typing indicator */ },
    editReply: async (payload = {}) => {
      if (replied) return;
      replied = true;
      return message.reply({
        content: typeof payload === 'string' ? payload : payload.content,
        allowedMentions: { repliedUser: true },
      });
    },
    followUp: async (payload = {}) => {
      return message.channel.send({
        content: typeof payload === 'string' ? payload : payload.content,
        allowedMentions: { repliedUser: false },
      });
    },
  };
}

// ─── Query extraction ───────────────────────────────────────────────────────
function extractQuery(message, client) {
  const botId = client?.user?.id;
  let content = message.content.trim();
  if (botId) {
    content = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
  }
  content = content.replace(/<@!?\d+>/g, '').trim();
  return content;
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function execute(message, client) {
  // ── Gate 1: Only #bot-chat ───────────────────────────────────────────────
  if (message.channelId !== BOT_CHAT_CHANNEL_ID) return;

  // ── Gate 2: Ignore bots (including self) ──────────────────────────────────
  if (message.author.bot) return;

  // ── Gate 2.4: Correction reply check ─────────────────────────────────────
  if (hasPendingCorrection(message.author.id, message.channelId)) {
    const corrResult = await processCorrection(message.author.id, message.channelId, message.content);
    try {
      const lm = global.__learningManager;
      if (lm && corrResult.question && corrResult.answer) {
        if (corrResult.action === 'corrected') {
          // Verified correction — store user's correction with high confidence
          lm.process({
            userId:   message.author.id,
            query:    `CORRECTION: ${corrResult.question}`,
            response: corrResult.answer,
            metadata: { interactionId: message.id, domain: 'correction', feedback: -1, confidence: corrResult.confidence || 0.8 },
          }).catch(() => {});
          // Also store the web validation evidence that confirmed it
          if (corrResult.validationSnippet) {
            lm.process({
              userId:   message.author.id,
              query:    `VALIDATED: ${corrResult.question}`,
              response: corrResult.validationSnippet,
              // Higher confidence than the correction — this is independently verified
              metadata: { interactionId: message.id, domain: 'validation_evidence', feedback: 1, confidence: Math.min(1, (corrResult.confidence || 0.8) + 0.1), trusted: true },
            }).catch(() => {});
          }
          startSession(message.author.id, message.channelId, message.guildId, corrResult.question.slice(0, 80));
        } else if (corrResult.action === 'corrected_unverified') {
          // Unverified correction — store with low confidence
          lm.process({
            userId:   message.author.id,
            query:    `CORRECTION_UNVERIFIED: ${corrResult.question}`,
            response: corrResult.answer,
            metadata: { interactionId: message.id, domain: 'correction', feedback: -1, confidence: 0.2 },
          }).catch(() => {});
        }
      }
    } catch { /* learning is additive */ }
    if (corrResult.action !== 'none') {
      await message.reply({ content: corrResult.message, allowedMentions: { repliedUser: true } });
      return;
    }
  }

  // ── Gate 2.5: Feedback reply check ───────────────────────────────────────
  if (hasPending(message.author.id, message.channelId)) {
    const fbResult = processReply(message.author.id, message.channelId, message.content);
    try {
      const lm = global.__learningManager;
      if (lm && fbResult.question && fbResult.answer) {
        if (fbResult.action === 'no') {
          lm.process({
            userId: message.author.id,
            query: `CORRECTION: ${fbResult.question}`,
            response: `The user said the answer was wrong. User reply: "${message.content.slice(0, 200)}"`,
            metadata: { interactionId: message.id, domain: 'correction', feedback: 0 },
          }).catch(() => {});
        } else if (fbResult.action === 'yes') {
          lm.process({
            userId: message.author.id,
            query: `CONFIRMED: ${fbResult.question}`,
            response: 'The user confirmed the answer was correct.',
            metadata: { interactionId: message.id, domain: 'confirmation', feedback: 1 },
          }).catch(() => {});
        }
      }
    } catch { /* learning is additive */ }
    if (fbResult.action !== 'none') {
      await message.reply({ content: fbResult.message, allowedMentions: { repliedUser: true } });
      return;
    }
  }

  // ── Gate 2.6: Active session continuation (no @mention needed) ────────────
  const isBotMentioned = message.mentions?.users?.has(client?.user?.id);

  if (isSessionActive(message.author.id, message.channelId)) {
    const rawContent = message.content.trim();
    if (isExitMessage(rawContent)) {
      endSession(message.author.id, message.channelId);
      await message.reply({
        content: 'Glad I could help! 💕 Mention me again anytime~',
        allowedMentions: { repliedUser: true },
      });
      return;
    }
    logger.info(`messageCreate: active session continuation from ${message.author.username}`);
  } else if (!isBotMentioned) {
    return;
  }

  // ── Gate 3: Extract query + session management ───────────────────────────
  const query = extractQuery(message, client);
  const userTag = `${message.author.username}#${message.author.discriminator}`;

  if (isBotMentioned && !isSessionActive(message.author.id, message.channelId)) {
    startSession(message.author.id, message.channelId, message.guildId, query.slice(0, 80));
    logger.info(`messageCreate: new session started for ${userTag} — "${query.slice(0, 60)}"`);
  }

  if (isSessionActive(message.author.id, message.channelId) && !isBotMentioned) {
    continueSession(message.author.id, message.channelId);
  }

  // ── Intent detection: Multi-comparison ─────────────────────────────────────
  if (isMultiComparison(query)) {
    const mentionCount = query.match(/<@!?\d+>/g)?.length ?? 0;
    logger.info(`messageCreate: multi-comparison intent from ${userTag} — ${mentionCount} mentions`);
    await message.channel.sendTyping().catch(() => {});
    try {
      const result = await compareMulti(message.author.id, message.guildId, query, message.mentions?.users);
      await message.reply({ content: result.content, allowedMentions: { repliedUser: true } });
    } catch (err) {
      logger.error(`compareMulti failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to compare everyone but something broke... 😣 maybe try fewer people or use `/leaderboard`? 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Intent detection: Fan comparison ───────────────────────────────────────
  if (isComparisonQuery(query)) {
    logger.info(`messageCreate: comparison intent from ${userTag}`);
    await message.channel.sendTyping().catch(() => {});
    try {
      const result = await compareStats(message.author.id, message.guildId, query, message.mentions?.users);
      await message.reply({ content: result.content, allowedMentions: { repliedUser: true } });
    } catch (err) {
      logger.error(`compareStats failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to compare but something broke... 😣 maybe try again? or use `/fan_gain` for each of you~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Intent detection: Leaderboard ──────────────────────────────────────────
  if (isLeaderboardQuery(query)) {
    logger.info(`messageCreate: leaderboard intent from ${userTag}`);
    await message.channel.sendTyping().catch(() => {});
    try {
      const lbResult = await getLeaderboard(message.guildId);
      await message.reply({ content: lbResult.content, allowedMentions: { repliedUser: true } });
    } catch (err) {
      logger.error(`leaderboard lookup failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to pull up the leaderboard but something broke... 😣 try using `/leaderboard` instead~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Intent detection: Personal stats ─────────────────────────────────────
  if (isPersonalStatsQuery(query)) {
    logger.info(`messageCreate: personal stats intent from ${userTag}`);
    await message.channel.sendTyping().catch(() => {});
    try {
      const stats = await getStats(message.author.id, message.guildId, query);
      await message.reply({ content: stats.content, allowedMentions: { repliedUser: true } });
    } catch (err) {
      logger.error(`personal stats failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i couldn't look up your stats right now... 😣 try `/profile` or `/fan_gain` instead~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── AI Pipeline: Topic filter + AI response ────────────────────────────────
  const classification = classify(query);
  if (!classification.isQualified) {
    const declineMsg = offTopicMessage(query, classification);
    await message.reply({ content: declineMsg, allowedMentions: { repliedUser: true } });
    return;
  }

  await message.channel.sendTyping().catch(() => {});
  const fakeInteraction = messageToInteraction(message);

  try {
    const result = await coordinator.aiCommand({
      commandName: 'ask',
      subcommand:  'ask',
      interaction: fakeInteraction,
      options:     { question: query },
      guildId:     message.guildId,
      userId:      message.author.id,
      channelId:   message.channelId,
    });

    if (result && result.success) {
      // ── Request feedback ──────────────────────────────────────────────────
      try {
        const fbPrompt = requestFeedback(message.author.id, message.channelId, query, result.content);
        if (fbPrompt) {
          await message.channel.send({ content: fbPrompt, allowedMentions: { repliedUser: false } });
          logger.info(`messageCreate: feedback requested from ${userTag}`);
        }
      } catch { /* feedback is best-effort */ }
    } else {
      const errMsg = (result && result.message) || (result && result.error) || 'unknown error';
      logger.warn(`AI answer failed for "${query.slice(0, 60)}": ${errMsg}`);
      await message.reply({
        content: "ah... i tried to answer but something went wrong... 😣 maybe try again in a moment? i'm really sorry~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
  } catch (err) {
    logger.error(`messageCreate AI pipeline error: ${err.message}`);
    try {
      await message.reply({
        content: "eep... something broke when i tried to think about that... 😭 could you try again? i'm really sorry~! 💕",
        allowedMentions: { repliedUser: true },
      });
    } catch { /* unrecoverable */ }
  }
}
