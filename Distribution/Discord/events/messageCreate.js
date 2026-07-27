// Distribution/Discord/events/messageCreate.js
// #bot-chat @mention handler — activates the UmaKraft AI when the bot is
// mentioned in the designated chat channel. Runs every message through the
// TopicFilter; qualified questions go to the AI pipeline; off-topic messages
// get a gentle, in-character decline.
//
// Channel: #bot-chat (1531205995009671201)
// Trigger: @UmaKraft <question>

import { classify, offTopicMessage } from '../../../AI/TopicFilter.js';
import { initialize as initAI, answer } from '../../../AI/aiService.js';
import { isConfigured as webSearchConfigured } from '../../../AI/webSearch.js';
import { createLogger } from '../../../core/pipelineLogger.js';
import { CHAT_CHANNEL_ID } from '../../../core/botConfig.js';
import { isPersonalStatsQuery, isComparisonQuery, isMultiComparison, isLeaderboardQuery, getStats, compareStats, compareMulti, getLeaderboard } from '../../../AI/personalStats.js';
import { hasPending, processReply, requestFeedback } from '../../../AI/FeedbackManager.js';

const logger = createLogger('messageCreate');

export const name = 'messageCreate';
export const once = false;

// ─── Configuration ──────────────────────────────────────────────────────────

const BOT_CHAT_CHANNEL_ID = CHAT_CHANNEL_ID || '1531205995009671201';
const MAX_QUERY_LENGTH = 500;
const MIN_QUERY_LENGTH = 2;

// ─── Gentle off-topic replies for when TopicFilter declines ─────────────────

const OFF_TOPIC_REPLIES = [
  "um... that's a little outside what i can help with... 💕 i'm here for uma musume, fan tracking, and most questions you can think of — just not politics, crypto, or medical stuff~!",
  "ah... i'm not really sure about that one... 😣 i can help with uma musume, circle stats, bot stuff, and almost anything else — but some topics are a bit too much for me!",
  "hey~ that's sweet of you to ask, but i don't think i should answer that... 🥺 i can search the web for most questions though! want to try something else?",
  "hmm... that's a bit tricky for me... 😕 i know a lot about uma musume, fan circles, and can web-search most topics — but not this one! want to ask differently? 💕",
];

function randomOffTopicReply() {
  return OFF_TOPIC_REPLIES[Math.floor(Math.random() * OFF_TOPIC_REPLIES.length)];
}

// ─── Mock interaction wrapper ───────────────────────────────────────────────
// The AI pipeline (aiService.answer) expects a Discord interaction object.
// We wrap the Message to look like an interaction so we can reuse the full
// pipeline without duplicating it.

function messageToInteraction(message) {
  const userId = message.author.id;
  let replied = false;

  return {
    // Core identity
    id: message.id,
    user: message.author,
    guildId: message.guildId,
    channelId: message.channelId,
    userId,

    // Flags for aiService
    deferred: true,
    replied: false,
    ephemeral: false,

    // reply() — called by successEnvelope or createDocsOnlyFallback
    reply: async (payload = {}) => {
      if (replied) {
        // Already replied via editReply — followUp instead
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

    // deferReply() — some paths defer before replying
    deferReply: async () => {
      // no-op — we use typing indicator instead
    },

    // editReply() — some paths edit a deferred reply
    editReply: async (payload = {}) => {
      if (replied) return;
      replied = true;
      return message.reply({
        content: typeof payload === 'string' ? payload : payload.content,
        allowedMentions: { repliedUser: true },
      });
    },

    // followUp() — fallback delivery
    followUp: async (payload = {}) => {
      return message.channel.send({
        content: typeof payload === 'string' ? payload : payload.content,
        allowedMentions: { repliedUser: false },
      });
    },
  };
}

// ─── Query extraction ───────────────────────────────────────────────────────
// Strips the @mention from the message and returns the clean question text.

function extractQuery(message, client) {
  const botId = client?.user?.id;
  let content = message.content.trim();

  // Remove @mention(s) of the bot
  if (botId) {
    content = content.replace(new RegExp(`<@!?${botId}>`, 'g'), '').trim();
  }

  // Fallback: remove any remaining @mention
  content = content.replace(/<@!?\d+>/g, '').trim();

  return content;
}

// ─── Entry point ────────────────────────────────────────────────────────────

export async function execute(message, client) {
  // ── Gate 1: Only #bot-chat ───────────────────────────────────────────────
  if (message.channelId !== BOT_CHAT_CHANNEL_ID) return;

  // ── Gate 2: Ignore bots (including self) ─────────────────────────────────
  if (message.author.bot) return;

  // ── Gate 2.5: Feedback reply check ─────────────────────────────────────────
  // If the user has a pending feedback request, their next message might be
  // a "yes" or "no" reply. Check BEFORE requiring @mention.
  if (hasPending(message.author.id, message.channelId)) {
    const fbResult = processReply(message.author.id, message.channelId, message.content);
    if (fbResult.action !== 'none') {
      await message.reply({
        content: fbResult.message,
        allowedMentions: { repliedUser: true },
      });
      return; // Feedback handled — don't process as new question
    }
    // If action is 'none' (no pending request found), fall through to normal flow
  }

  // ── Gate 3: Must @mention the bot ────────────────────────────────────────
  const botId = client?.user?.id;
  if (!botId) {
    logger.warn('messageCreate: client.user.id not available — skipping');
    return;
  }

  const mentioned = message.mentions?.has(botId);
  if (!mentioned) return;

  // ── Gate 4: Extract and validate the query ───────────────────────────────
  const query = extractQuery(message, client);

  if (!query || query.length < MIN_QUERY_LENGTH) {
    await message.reply({
      content: "hey~! you mentioned me... did you have a question? 💕 ask me about uma musume, your circle, the bot, or anything you're curious about — i can search the web too~!",
      allowedMentions: { repliedUser: true },
    });
    return;
  }

  if (query.length > MAX_QUERY_LENGTH) {
    await message.reply({
      content: `ah... that's a really long question (${query.length} characters!)... 🥺 could you maybe shorten it a bit? my brain works better with shorter questions~ 💕`,
      allowedMentions: { repliedUser: true },
    });
    return;
  }

  // ── Gate 5: TopicFilter classification ───────────────────────────────────
  const classification = classify(query, '/ask');
  const userTag = message.author.tag ?? message.author.username ?? 'unknown';

  logger.info(`messageCreate: ${userTag} asked "${query.slice(0, 80)}" → ${classification.topic}`);

  // ── Off-topic: gentle decline ────────────────────────────────────────────
  if (classification.rejected || classification.topic === 'off-topic') {
    await message.reply({
      content: randomOffTopicReply(),
      allowedMentions: { repliedUser: true },
    });
    logger.info(`messageCreate: declined off-topic from ${userTag}`);
    return;
  }

  // ── Multi-person fan comparison (3–30 trainers) ───────────────────────────
  // Checked BEFORE binary comparison since 3+ mentions need a ranked list.
  if (isMultiComparison(query)) {
    const mentionCount = query.match(/<@!?\d+>/g)?.length ?? 0;
    logger.info(`messageCreate: multi-comparison intent from ${userTag} — ${mentionCount} mentions`);
    await message.channel.sendTyping().catch(() => {});

    try {
      const result = await compareMulti(
        message.author.id,
        message.guildId,
        query,
        message.mentions?.users,
      );
      await message.reply({
        content: result.content,
        allowedMentions: { repliedUser: true },
      });
    } catch (err) {
      logger.error(`compareMulti failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to compare everyone but something broke... 😣 maybe try fewer people or use `/leaderboard`? 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Fan comparison intent detection ───────────────────────────────────────
  // Check if the user is comparing two trainers' fan counts.
  // "difference between me and @Trainer", "@A vs @B fans", etc.
  if (isComparisonQuery(query)) {
    logger.info(`messageCreate: comparison intent from ${userTag}`);
    await message.channel.sendTyping().catch(() => {});

    try {
      const result = await compareStats(
        message.author.id,
        message.guildId,
        query,
        message.mentions?.users,
      );
      await message.reply({
        content: result.content,
        allowedMentions: { repliedUser: true },
      });
    } catch (err) {
      logger.error(`compareStats failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to compare but something broke... 😣 maybe try again? or use `/fan_gain` for each of you~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Leaderboard intent detection ──────────────────────────────────────────
  // Check if the user is asking about the leaderboard, top trainers, or rankings.
  // Must be checked BEFORE personal stats to avoid "where do i rank" false matches.
  if (isLeaderboardQuery(query)) {
    logger.info(`messageCreate: leaderboard intent from ${userTag}`);
    await message.channel.sendTyping().catch(() => {});

    try {
      const lbResult = await getLeaderboard(message.guildId);
      await message.reply({
        content: lbResult.content,
        allowedMentions: { repliedUser: true },
      });
    } catch (err) {
      logger.error(`leaderboard lookup failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to pull up the leaderboard but something broke... 😣 try using `/leaderboard` instead~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Personal stats intent detection ───────────────────────────────────────
  // Check if the user is asking about THEIR OWN fan count, rank, or stats.
  // If so, query the live database directly instead of the AI knowledge base.
  if (isPersonalStatsQuery(query)) {
    logger.info(`messageCreate: personal stats intent from ${userTag} — querying depot`);
    await message.channel.sendTyping().catch(() => {});

    try {
      const statsResult = await getStats(message.author.id, message.guildId);
      await message.reply({
        content: statsResult.content,
        allowedMentions: { repliedUser: true },
      });
    } catch (err) {
      logger.error(`personalStats lookup failed for ${userTag}: ${err.message}`);
      await message.reply({
        content: "ah... i tried to look up your stats but something went wrong... 😣 try using `/fan_gain` instead~! 💕",
        allowedMentions: { repliedUser: true },
      });
    }
    return;
  }

  // ── Show typing indicator ────────────────────────────────────────────────
  await message.channel.sendTyping().catch(() => {});

  // ── Route to AI pipeline ─────────────────────────────────────────────────
  try {
    await initAI();
    const mockInteraction = messageToInteraction(message);

    const useWeb = webSearchConfigured();
    logger.info(`messageCreate: routing to AI — webSearch=${useWeb ? 'enabled' : 'disabled'}`);

    const result = await answer({
      query,
      subcommand: 'ask',
      interaction: mockInteraction,
      userId: message.author.id,
      mode: 'chat',
      retrievalOverride: useWeb ? 'web-first' : null,
    });

    // answer() returns successEnvelope / errorEnvelope — the mock interaction
    // already handled the reply. If the envelope says failure and no reply was
    // sent, send a fallback.
    if (result && !result.success) {
      logger.warn(`AI answer failed for "${query.slice(0, 60)}": ${result.message || result.error}`);
      // Check if the mock already replied — if not, send fallback
      try {
        await message.reply({
          content: "ah... i tried to answer but something went wrong... 😣 maybe try again in a moment? i'm really sorry~! 💕",
          allowedMentions: { repliedUser: true },
        });
      } catch { /* fine if already replied */ }
    }

    // ── Request feedback after successful answer ────────────────────────────
    if (result && result.success) {
      try {
        const answerText = result.content || '';
        const fbPrompt = requestFeedback(message.author.id, message.channelId, query, answerText);
        await message.channel.send({
          content: fbPrompt,
          allowedMentions: { repliedUser: false },
        });
        logger.info(`messageCreate: feedback requested from ${userTag}`);
      } catch { /* feedback is best-effort */ }
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
