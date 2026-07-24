// AI/ContentGenerator.js
// Community message generation pipeline — 100–150 word enforced output.
//
// Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
// Spec:      AI/CONTENT_GENERATOR.md
//
// Public API:
//   generate(type, variables) → { message, attempts, usedFallback }

import log from '../core/log.js';
import config from './Configuration.js';
import { assemble } from './PromptSystem.js';
import { generate as apiGenerate } from './APIProvider.js';
import { validate, hardRejectMessage } from './ResponseValidator.js';

// ---------------------------------------------------------------------------
// Message type registry — prompt text and fallbacks
// ---------------------------------------------------------------------------

const MESSAGE_TYPES = {
  greeting: {
    required: [],
    optional: ['circleName', 'date', 'leaderName'],
    buildPrompt: (v) =>
      `You are writing a daily greeting message for the Umakraft Discord server.\n\n` +
      `The message is for ${v.circleName ?? 'the circle'}.\n` +
      `${v.date ? `Date: ${v.date}\n` : ''}` +
      `\nWrite a warm, positive, and energetic greeting that:\n` +
      `- Welcomes trainers to a new day of training\n` +
      `- Encourages checking the leaderboard and pushing for higher fan counts\n` +
      `- Celebrates the circle's community spirit\n` +
      `- Ends with a motivating call to action\n\n` +
      `Requirements:\n` +
      `- Between 100 and 150 words\n` +
      `- Positive and community-appropriate tone\n` +
      `- May include 1–2 relevant emojis\n` +
      `- Do not mention real-world events, politics, or anything outside Uma Musume / Umakraft`,
    fallback: (v) =>
      `🌅 Good morning and welcome to a new day of training! The leaderboard awaits, ` +
      `and every fan you earn today brings ${v.circleName ? `*${v.circleName}*` : 'the circle'} ` +
      `closer to its goals. Stay consistent, support each other, and let's make today count. ` +
      `The best trainers aren't just the ones with the most fans — they're the ones who show up ` +
      `every day and give their best. Let's go! 🔥`,
  },

  milestone: {
    required: ['trainerName', 'milestoneValue'],
    optional: ['circleName', 'previousMilestone'],
    buildPrompt: (v) =>
      `You are writing a milestone announcement for the Umakraft Discord server.\n\n` +
      `Trainer: ${v.trainerName}\n` +
      `Milestone: ${Number(v.milestoneValue).toLocaleString()} fans\n` +
      `Circle: ${v.circleName ?? 'the circle'}\n` +
      `${v.previousMilestone ? `Previous milestone: ${Number(v.previousMilestone).toLocaleString()} fans\n` : ''}` +
      `\nWrite a celebration message that:\n` +
      `- Congratulates the trainer by name on their fan milestone\n` +
      `- Acknowledges the effort and dedication this represents\n` +
      `- Celebrates the achievement as a circle win, not just a personal one\n` +
      `- Ends with an inspiring forward-looking statement\n\n` +
      `Requirements:\n` +
      `- Between 100 and 150 words\n` +
      `- Use bold formatting for the trainer name and milestone value\n` +
      `- May include 1–2 celebration emojis (🎉, 🏆, ⭐, ✨)\n` +
      `- Warm, genuine, not over-the-top\n` +
      `- Do not invent specific details not provided`,
    fallback: (v) =>
      `🎉 Congratulations to **${v.trainerName}** on reaching **${Number(v.milestoneValue).toLocaleString()} fans**! ` +
      `This milestone is a true testament to your dedication and hard work. ` +
      `The entire ${v.circleName ? `*${v.circleName}*` : 'circle'} celebrates with you today. ` +
      `Keep pushing forward — the next milestone is already within reach, and we can't wait ` +
      `to celebrate with you again. Well done! 🏆`,
  },

  achievement: {
    required: ['trainerName', 'achievementName'],
    optional: ['circleName', 'description'],
    buildPrompt: (v) =>
      `You are writing an achievement announcement for the Umakraft Discord server.\n\n` +
      `Trainer: ${v.trainerName}\n` +
      `Achievement: ${v.achievementName}\n` +
      `Circle: ${v.circleName ?? 'the circle'}\n` +
      `${v.description ? `Description: ${v.description}\n` : ''}` +
      `\nWrite a celebratory announcement that:\n` +
      `- Names the trainer and the achievement clearly\n` +
      `- Explains why the achievement is meaningful to the circle\n` +
      `- Inspires other trainers to aim for similar goals\n` +
      `- Ends with a warm congratulation\n\n` +
      `Requirements:\n` +
      `- Between 100 and 150 words\n` +
      `- Use bold for the trainer name and achievement name\n` +
      `- May include 1–2 appropriate emojis\n` +
      `- Community-appropriate, positive tone`,
    fallback: (v) =>
      `⭐ Congratulations to **${v.trainerName}** for unlocking the **${v.achievementName}** achievement! ` +
      `This accomplishment highlights the dedication and skill that make ` +
      `${v.circleName ? `*${v.circleName}*` : 'our circle'} great. ` +
      `Your achievement inspires every trainer here to push harder and aim higher. ` +
      `Well done, and here's to many more milestones ahead! 🌟`,
  },

  leaderboard: {
    required: ['topTrainers'],
    optional: ['period', 'circleName', 'totalTrainers'],
    buildPrompt: (v) => {
      const trainers = Array.isArray(v.topTrainers)
        ? v.topTrainers.map((t, i) => `#${t.rank ?? i + 1} ${t.name} — ${Number(t.fans ?? 0).toLocaleString()} fans`).join('\n')
        : String(v.topTrainers);
      return (
        `You are writing a leaderboard announcement for the Umakraft Discord server.\n\n` +
        `Circle: ${v.circleName ?? 'the circle'}\n` +
        `Period: ${v.period ?? 'this period'}\n` +
        `Top Trainers:\n${trainers}\n\n` +
        `Write a message that:\n` +
        `- Celebrates the top-ranked trainers by name\n` +
        `- Acknowledges the competitive spirit of the whole circle\n` +
        `- Encourages trainers outside the top spots to keep pushing\n` +
        `- Ends with an energising forward-looking statement\n\n` +
        `Requirements:\n` +
        `- Between 100 and 150 words\n` +
        `- Mention the top 3 trainers by name and rank\n` +
        `- Use bold formatting for trainer names\n` +
        `- Competitive but inclusive tone\n` +
        `- May include 1–2 appropriate emojis\n` +
        `- Do not invent fan counts or ranks not provided`
      );
    },
    fallback: (v) =>
      `🏆 The ${v.period ?? 'period'} leaderboard is live for *${v.circleName ?? 'the circle'}*! ` +
      `Congratulations to our top performers who set an incredible pace this period. ` +
      `Every trainer in this circle has contributed to our collective strength. ` +
      `Check the leaderboard embed for the full rankings, and let's get ready for the next period. ` +
      `The competition never stops — and neither do we! 🔥`,
  },

  warning: {
    required: ['trainerName', 'deficitAmount'],
    optional: ['circleName', 'deadline'],
    buildPrompt: (v) =>
      `You are writing a fan deficit warning for the Umakraft Discord server.\n\n` +
      `Trainer: ${v.trainerName}\n` +
      `Deficit: ${Number(v.deficitAmount).toLocaleString()} fans behind projection\n` +
      `Circle: ${v.circleName ?? 'the circle'}\n` +
      `${v.deadline ? `Deadline: ${v.deadline}\n` : ''}` +
      `\nWrite a message that:\n` +
      `- Notifies the trainer of their current fan deficit\n` +
      `- Frames the deficit as a challenge to overcome, not a failure\n` +
      `- Offers encouragement and a forward-looking push\n` +
      `- Reminds the trainer that the circle is there to support them\n` +
      `${v.deadline ? '- Gently creates urgency around the deadline\n' : ''}` +
      `\nRequirements:\n` +
      `- Between 100 and 150 words\n` +
      `- Supportive, warm tone — never scolding or negative\n` +
      `- Use bold for the trainer name and deficit amount\n` +
      `- Do not speculate on why the deficit occurred\n` +
      `- May include 1 gentle emoji (no celebration emojis)`,
    fallback: (v) =>
      `📊 **${v.trainerName}**, you're currently **${Number(v.deficitAmount).toLocaleString()} fans** ` +
      `behind your projected pace. Now is a great time to sync and push your training forward — ` +
      `the gap is closeable, and the circle is cheering you on. Keep going! 💪`,
  },

  reminder: {
    required: ['eventName', 'eventDate'],
    optional: ['circleName', 'details'],
    buildPrompt: (v) =>
      `You are writing an event reminder for the Umakraft Discord server.\n\n` +
      `Event: ${v.eventName}\n` +
      `Date: ${v.eventDate}\n` +
      `Circle: ${v.circleName ?? 'the circle'}\n` +
      `${v.details ? `Details: ${v.details}\n` : ''}` +
      `\nWrite a reminder message that:\n` +
      `- Announces the upcoming event clearly\n` +
      `- Explains why it matters to the circle\n` +
      `- Encourages trainers to prepare and participate\n` +
      `- Ends with a call to action\n\n` +
      `Requirements:\n` +
      `- Between 100 and 150 words\n` +
      `- Use bold for the event name and date\n` +
      `- Energetic but informative tone\n` +
      `- May include 1–2 appropriate emojis`,
    fallback: (v) =>
      `📅 Reminder: **${v.eventName}** is coming up on **${v.eventDate}**! ` +
      `This is an important event for ${v.circleName ? `*${v.circleName}*` : 'the circle'}, ` +
      `so mark your calendar and make sure you're prepared. ` +
      `${v.details ? v.details + ' ' : ''}` +
      `Don't miss it — let's show up strong together! 💪`,
  },

  documentation: {
    required: ['topic'],
    optional: ['context', 'audience'],
    buildPrompt: (v) =>
      `You are writing a documentation explanation for the Umakraft Discord server.\n\n` +
      `Topic: ${v.topic}\n` +
      `${v.context ? `Context: ${v.context}\n` : ''}` +
      `Audience: ${v.audience ?? 'Discord server members unfamiliar with the codebase'}\n\n` +
      `Write a clear, accessible explanation that:\n` +
      `- Introduces the topic in plain language\n` +
      `- Explains its purpose within Umakraft\n` +
      `- Gives one or two concrete examples\n` +
      `- Ends with where to learn more or how to use it\n\n` +
      `Requirements:\n` +
      `- Between 100 and 150 words\n` +
      `- Plain language — avoid jargon where possible\n` +
      `- Use bold for key terms\n` +
      `- Positive and informative tone`,
    fallback: (v) =>
      `📖 **${v.topic}** is a component of the Umakraft bot system that processes and delivers ` +
      `trainer data to the Discord community. If you'd like to know more about how it works, ` +
      `ask a circle leader or check the repository documentation. We're always happy to explain! 🌟`,
  },
};

export const VALID_TYPES = Object.keys(MESSAGE_TYPES);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validate required variables for a given message type.
 * @returns {{ valid: boolean, missing: string[] }}
 */
function checkRequiredVars(type, variables) {
  const schema = MESSAGE_TYPES[type];
  const missing = schema.required.filter(k => variables[k] == null);
  return { valid: missing.length === 0, missing };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * @typedef {object} GenerationResult
 * @property {string}  message      — final message text
 * @property {number}  attempts     — number of generation attempts made
 * @property {boolean} usedFallback — true if the pre-written fallback was returned
 */

/**
 * Generate a community message.
 *
 * @param {'greeting'|'milestone'|'achievement'|'leaderboard'|'warning'|'reminder'|'documentation'} type
 * @param {Record<string, any>} [variables]
 * @returns {Promise<GenerationResult>}
 */
export async function generate(type, variables = {}) {
  if (!MESSAGE_TYPES[type]) {
    const list = VALID_TYPES.join(', ');
    throw new Error(
      `Unknown message type "${type}". Valid types: ${list}.`
    );
  }

  const schema = MESSAGE_TYPES[type];

  // Validate required variables
  const { valid, missing } = checkRequiredVars(type, variables);
  if (!valid) {
    throw new Error(
      `Missing required variable(s) for message type "${type}": ${missing.join(', ')}.`
    );
  }

  const messagePrompt = schema.buildPrompt(variables);
  let attempts = 0;
  let lastResponse = null;
  let extraInstruction = '';

  const MAX_ATTEMPTS = 2;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    attempts = attempt;

    // Assemble the prompt via PromptSystem
    const prompt = assemble('message', '', extraInstruction || messagePrompt, {
      messagePrompt: messagePrompt + (extraInstruction ? `\n\nIMPORTANT: ${extraInstruction}` : ''),
    });

    log.info(`[AI/ContentGenerator] type="${type}" attempt=${attempt}`);

    let responseText;
    try {
      const result = await apiGenerate(prompt, { complexity: 'complex' });
      responseText = result.text ?? result;
    } catch (err) {
      log.error(`[AI/ContentGenerator] API error on attempt ${attempt}: ${err.message}`);
      break;
    }

    lastResponse = responseText;

    // Validate
    const validation = validate(responseText, 'message', { attempt });

    if (validation.passed) {
      log.info(
        `[AI/ContentGenerator] type="${type}" attempt=${attempt} PASS ` +
        `wordCount=${validation.wordCount}`
      );
      return { message: responseText, attempts, usedFallback: false };
    }

    log.warn(
      `[AI/ContentGenerator] type="${type}" attempt=${attempt} FAIL ` +
      `action=${validation.action} reasons=${validation.failureReasons.join('; ')}`
    );

    if (validation.action === 'hard-reject') break;

    // Set correction instruction for next attempt
    if (validation.regenerateInstruction) {
      extraInstruction = validation.regenerateInstruction;
    }
  }

  // Both attempts failed — return pre-written fallback
  log.warn(`[AI/ContentGenerator] type="${type}" — returning fallback after ${attempts} attempt(s).`);
  const fallbackText = schema.fallback(variables);

  return { message: fallbackText, attempts, usedFallback: true };
}
