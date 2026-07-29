// Distribution/Discord/events/messageCreate.js
// @mention handler — activates the UmaKraft bot when mentioned in any channel.
//
// Routing priority:
//   1. Correction / feedback reply checks (active session follow-ups)
//   2. Session continuation (no re-mention needed while session is open)
//   3. Multi-user comparison  (@User1 vs @User2 vs @User3 — needs Discord entities)
//   4. Two-user comparison    (@User vs @User2 — needs Discord entities)
//   5. IntentRouter           (LLM classifies message → coordinator command)
//   6. TopicFilter + AI chat  (fallback for CHAT intent or low-confidence)
//
// Channel restriction: none — @mentions are handled in any channel.
//
// NOTE: Admin commands (ai, adminSync, adminSyncCards, warningSettings, etc.)
//       are excluded from the IntentRouter registry and are never routable
//       via @mention regardless of permissions.

import { classify as topicClassify, offTopicMessage } from '../../../AI/TopicFilter.js';
import { classify as intentClassify, INTENT_CONFIDENCE_THRESHOLD } from '../../../AI/IntentRouter.js';
import { coordinator } from '../../Coordinator/index.js';
import { dispatch }    from '../../Dispatcher/index.js';
import { createLogger } from '../../../core/pipelineLogger.js';
import {
  isMultiComparison, isComparisonQuery,
  compareStats, compareMulti,
} from '../../../AI/personalStats.js';
import { hasPending, hasPendingCorrection, processReply, processCorrection, requestFeedback } from '../../../AI/FeedbackManager.js';
import {
  startSession, continueSession, endSession,
  isSessionActive, isExitMessage,
} from '../../../AI/AdvancedFeatures.js';

const logger = createLogger('messageCreate');

export const name = 'messageCreate';
export const once = false;

// ─── Fake interaction wrapper ────────────────────────────────────────────────
// Wraps a Discord Message so it can be passed to the coordinator and Dispatcher,
// which expect an interaction-shaped object with reply/editReply/followUp methods.
// Supports embeds and files so image/embed pipeline results render correctly.

function messageToInteraction(message) {
  const userId = message.author.id;
  let replied = false;

  function buildPayload(payload) {
    if (typeof payload === 'string') {
      return { content: payload, allowedMentions: { repliedUser: true } };
    }
    const out = { allowedMentions: { repliedUser: true } };
    if (payload.content != null)  out.content = payload.content;
    if (payload.embeds  != null)  out.embeds  = payload.embeds;
    if (payload.files   != null)  out.files   = payload.files;
    return out;
  }

  return {
    id:        message.id,
    user:      message.author,
    member:    message.member ?? null,
    guildId:   message.guildId,
    channelId: message.channelId,
    userId,
    // Signal to Dispatcher/send.js that a "defer" already happened so it uses editReply.
    deferred:  true,
    replied:   false,
    ephemeral: false,

    reply: async (payload = {}) => {
      if (replied) {
        const extra = typeof payload === 'string' ? { content: payload } : payload;
        return message.channel.send({ ...extra, allowedMentions: { repliedUser: false } });
      }
      replied = true;
      return message.reply(buildPayload(payload));
    },

    deferReply: async () => { /* no-op — sendTyping is used instead */ },

    editReply: async (payload = {}) => {
      if (replied) {
        const extra = typeof payload === 'string' ? { content: payload } : payload;
        return message.channel.send({ ...extra, allowedMentions: { repliedUser: false } });
      }
      replied = true;
      return message.reply(buildPayload(payload));
    },

    followUp: async (payload = {}) => {
      const extra = typeof payload === 'string' ? { content: payload } : payload;
      return message.channel.send({ ...extra, allowedMentions: { repliedUser: false } });
    },
  };
}

// ─── Query extraction ────────────────────────────────────────────────────────
function extractQuery(message, client) {
  const botId = client?.user?.id;
  let content = message.content.trim();
  if (botId) content = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
  content = content.replace(/<@!?\d+>/g, '').trim();
  return content;
}

// ─── Command router ───────────────────────────────────────────────────────────
// Maps an intent name (from IntentRouter) to a coordinator call.
// Returns an envelope for dispatch(), or null if the intent is unhandled.
// For coordinator.aiCommand the response is already sent internally; those
// cases return null so the caller does not attempt a second dispatch.

async function routeIntent(intent, args, fakeInteraction, message) {
  const base = {
    guildId:     message.guildId,
    userId:      message.author.id,
    channelId:   message.channelId,
    interaction: fakeInteraction,
  };

  switch (intent) {

    case 'fan_gain':
      return coordinator.fanGain({
        ...base,
        commandName: 'fan_gain',
        options: {
          member:  null,
          trainer: args.trainer ?? null,
          circle:  args.circle  ?? null,
        },
      });

    case 'profile':
      return coordinator.profile({
        ...base,
        commandName: 'profile',
        options: {
          member:       null,
          user:         null,
          targetUserId: message.author.id,
          trainer:      args.trainer ?? null,
          circle:       args.circle  ?? null,
          self:         !args.trainer,
        },
      });

    case 'leaderboard':
      return coordinator.leaderboard({
        ...base,
        commandName: 'leaderboard',
        options: { scope: null, circle: args.circle ?? null, date: null },
      });

    case 'total_fan':
      return coordinator.totalFan({
        ...base,
        commandName: 'total_fan',
        options: {
          member:  null,
          trainer: args.trainer ?? null,
          circle:  args.circle  ?? null,
        },
      });

    case 'total_circle_fan_gain':
      return coordinator.totalCircleFanGain({
        ...base,
        commandName: 'total_circle_fan_gain',
        options: { circle: args.circle ?? null },
      });

    case 'circle_master':
      return coordinator.circleMaster({
        ...base,
        commandName: 'circle_master',
        options: { circle: args.circle ?? null },
      });

    case 'inter_circle_leaderboard':
      return coordinator.interCircleLeaderboard({
        ...base,
        commandName: 'inter_circle_leaderboard',
        options: {},
      });

    case 'club_gain':
      return coordinator.clubGain({
        ...base,
        commandName: 'club_gain',
        options: {},
      });

    case 'join_date':
      return coordinator.joinDate({
        ...base,
        commandName: 'join_date',
        options: {
          member:  null,
          trainer: args.trainer ?? null,
        },
      });

    case 'member_list':
      return coordinator.memberList({
        ...base,
        commandName: 'member_list',
        options: { circle: args.circle ?? null },
      });

    case 'search_trainer': {
      const q = args.trainer ?? args.query ?? '';
      if (!q) return null;
      return coordinator.searchTrainer({
        ...base,
        commandName: 'search_trainer',
        options: { query: q },
      });
    }

    case 'search':
      // aiCommand handles its own reply via fakeInteraction.editReply — no dispatch needed.
      await coordinator.aiCommand({
        ...base,
        commandName: 'search',
        subcommand:  'web-search',
        options:     { query: args.query ?? args.trainer ?? '' },
      });
      return null;

    case 'status':
      return coordinator.status({
        ...base,
        commandName: 'status',
        options: {},
      });

    case 'circle_status':
      return coordinator.circleStatus({
        ...base,
        commandName: 'circle_status',
        options: { circle: args.circle ?? null },
      });

    case 'help':
      return coordinator.help({
        ...base,
        commandName: 'help',
        options: {},
      });

    case 'link':
      return coordinator.link({
        ...base,
        commandName: 'link',
        options: { trainer: args.trainer ?? null },
      });

    case 'unlink':
      return coordinator.unlink({
        ...base,
        commandName: 'unlink',
        options: { trainer: args.trainer ?? null },
      });

    case 'link_list':
      return coordinator.linkList({
        ...base,
        commandName: 'link_list',
        options: {},
      });

    case 'set_timezone':
      // Needs a precise timezone string — guide the user to the slash command.
      return {
        success:   true,
        type:      'embed',
        ephemeral: false,
        result: {
          title:       '💡 Use the Slash Command',
          description: 'To set your timezone, please use `/set_timezone` — it shows a timezone picker that makes it easy to find the right value~! 💕',
        },
        interaction: fakeInteraction,
      };

    default:
      return null;
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function execute(message, client) {
  // ── Gate: Ignore bots (including self) ────────────────────────────────────
  if (message.author.bot) return;

  // ── Correction reply check ────────────────────────────────────────────────
  if (hasPendingCorrection(message.author.id, message.channelId)) {
    const corrResult = await processCorrection(message.author.id, message.channelId, message.content);
    try {
      const lm = global.__learningManager;
      if (lm && corrResult.question && corrResult.answer) {
        if (corrResult.action === 'corrected') {
          lm.process({
            userId:   message.author.id,
            query:    `CORRECTION: ${corrResult.question}`,
            response: corrResult.answer,
            metadata: { interactionId: message.id, domain: 'correction', feedback: -1, confidence: corrResult.confidence || 0.8 },
          }).catch(() => {});
          if (corrResult.validationSnippet) {
            lm.process({
              userId:   message.author.id,
              query:    `VALIDATED: ${corrResult.question}`,
              response: corrResult.validationSnippet,
              metadata: { interactionId: message.id, domain: 'validation_evidence', feedback: 1, confidence: Math.min(1, (corrResult.confidence || 0.8) + 0.1), trusted: true },
            }).catch(() => {});
          }
          startSession(message.author.id, message.channelId, message.guildId, corrResult.question.slice(0, 80));
        } else if (corrResult.action === 'corrected_unverified') {
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

  // ── Feedback reply check ──────────────────────────────────────────────────
  if (hasPending(message.author.id, message.channelId)) {
    const fbResult = processReply(message.author.id, message.channelId, message.content);
    try {
      const lm = global.__learningManager;
      if (lm && fbResult.question && fbResult.answer) {
        if (fbResult.action === 'no') {
          lm.process({
            userId:   message.author.id,
            query:    `CORRECTION: ${fbResult.question}`,
            response: `The user said the answer was wrong. User reply: "${message.content.slice(0, 200)}"`,
            metadata: { interactionId: message.id, domain: 'correction', feedback: 0 },
          }).catch(() => {});
        } else if (fbResult.action === 'yes') {
          lm.process({
            userId:   message.author.id,
            query:    `CONFIRMED: ${fbResult.question}`,
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

  // ── Session continuation (no @mention needed while session is open) ────────
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

  // ── Extract query + session management ────────────────────────────────────
  const query   = extractQuery(message, client);
  const userTag = `${message.author.username}#${message.author.discriminator}`;

  if (isBotMentioned && !isSessionActive(message.author.id, message.channelId)) {
    startSession(message.author.id, message.channelId, message.guildId, query.slice(0, 80));
    logger.info(`messageCreate: new session started for ${userTag} — "${query.slice(0, 60)}"`);
  }

  if (isSessionActive(message.author.id, message.channelId) && !isBotMentioned) {
    continueSession(message.author.id, message.channelId);
  }

  // ── Fast path: multi-user comparison (@User vs @User2 vs @User3) ──────────
  // Handled before IntentRouter because it needs Discord entity resolution.
  if (isMultiComparison(query)) {
    const mentionCount = query.match(/<@!?\d+>/g)?.length ?? 0;
    logger.info(`messageCreate: multi-comparison from ${userTag} — ${mentionCount} mentions`);
    await message.channel.sendTyping().catch(() => {});
    try {
      const result = await compareMulti(message.author.id, message.guildId, query, message.mentions?.users);
      if (!result.success) {
        await message.reply({ content: result.content ?? 'Something went wrong~ 😣', allowedMentions: { repliedUser: true } });
      } else if (result.embed) {
        await message.reply({ embeds: [result.embed], allowedMentions: { repliedUser: true } });
      } else {
        await message.reply({ content: result.content, allowedMentions: { repliedUser: true } });
      }
    } catch (err) {
      logger.error(`compareMulti failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to compare everyone but something broke... 😣 maybe try fewer people or use `/leaderboard`? 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Fast path: two-user comparison ───────────────────────────────────────
  if (isComparisonQuery(query)) {
    logger.info(`messageCreate: comparison from ${userTag}`);
    await message.channel.sendTyping().catch(() => {});
    try {
      const result = await compareStats(message.author.id, message.guildId, query, message.mentions?.users);
      if (!result.success) {
        await message.reply({ content: result.content ?? 'Something went wrong~ 😣', allowedMentions: { repliedUser: true } });
      } else if (result.embed) {
        await message.reply({ embeds: [result.embed], allowedMentions: { repliedUser: true } });
      } else {
        await message.reply({ content: result.content, allowedMentions: { repliedUser: true } });
      }
    } catch (err) {
      logger.error(`compareStats failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to compare but something broke... 😣 maybe try again or use `/fan_gain` for each of you~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── IntentRouter: LLM-based command routing ───────────────────────────────
  await message.channel.sendTyping().catch(() => {});

  let intentResult = { intent: 'CHAT', confidence: 0, args: {} };
  try {
    intentResult = await intentClassify(query);
  } catch (err) {
    logger.warn(`messageCreate: IntentRouter failed, falling back to AI chat — ${err.message}`);
  }

  const { intent, confidence, args } = intentResult;

  if (confidence >= INTENT_CONFIDENCE_THRESHOLD && intent !== 'CHAT') {
    logger.info(`messageCreate: routing intent=${intent} confidence=${(confidence * 100).toFixed(0)}% for ${userTag}`);
    const fakeInteraction = messageToInteraction(message);
    try {
      const envelope = await routeIntent(intent, args, fakeInteraction, message);
      if (envelope !== null) {
        await dispatch(envelope);
      }
      return;
    } catch (err) {
      logger.error(`messageCreate: intent routing failed intent=${intent}: ${err.message}`);
      await message.reply({
        content: `ah... something went wrong running \`/${intent}\`... 😣 try the slash command directly~! 💕`,
        allowedMentions: { repliedUser: true },
      });
      return;
    }
  }

  // ── AI chat pipeline: topic filter + AI response ─────────────────────────
  const classification = topicClassify(query);
  if (classification.rejected) {
    const declineMsg = offTopicMessage(query, classification);
    await message.reply({ content: declineMsg, allowedMentions: { repliedUser: true } });
    return;
  }

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
      // Request feedback
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
