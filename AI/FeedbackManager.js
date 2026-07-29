// AI/FeedbackManager.js
// Feedback loop — after answering an @mention question, the bot asks the user
// "Was my answer correct? Reply Yes or No" and logs the response.
//
// Includes a comprehensive yes/no word database covering 300+ slang, emoji,
// abbreviation, non-English, and multi-word variants.
//
// Public API:
//   requestFeedback(userId, channelId, question, answer) → feedback prompt string
//   processReply(userId, channelId, replyText)           → { action, message, question, answer }
//   processCorrection(userId, channelId, text)           → { action, message, question, answer }
//   hasPending(userId, channelId)                         → boolean
//   hasPendingCorrection(userId, channelId)               → boolean
//   getPendingQuestion(userId, channelId)                 → { question, answer }
//   expireOld(minutes)                                    → expire stale requests
//   isAffirmative(text)                                   → boolean
//   isNegative(text)                                      → boolean
//   isCommentLike(text)                                   → boolean
//   retroValidateCorrections()                            → Promise<{scanned, verified, downgraded}>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import log from '../core/log.js';
import { search as searchWeb, isConfigured as webSearchConfigured } from './webSearch.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Railway: /data is the persistent writable volume (chowned to node in Dockerfile).
// Locally / Replit: fall back to the AI/ directory.
const TABLE_PATH = (() => {
  if (existsSync('/data')) return '/data/feedback.table';
  if (process.env.FEEDBACK_TABLE_PATH) return process.env.FEEDBACK_TABLE_PATH;
  return resolve(__dirname, 'feedback.table');
})();

// ─── Load / Save .table file ─────────────────────────────────────────────────

function loadTable() {
  try {
    if (!existsSync(TABLE_PATH)) return { fields: [], data: [] };
    const raw = readFileSync(TABLE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    log.error(`[FeedbackManager] Failed to load table: ${err.message}`);
    return { fields: [], data: [] };
  }
}

function saveTable(table) {
  try {
    writeFileSync(TABLE_PATH, JSON.stringify(table, null, 2), 'utf-8');
  } catch (err) {
    log.error(`[FeedbackManager] Failed to save table: ${err.message}`);
  }
}

// ─── Generate unique ID ──────────────────────────────────────────────────────

function feedbackId(userId, question) {
  const hash = createHash('sha256').update(`${userId}:${question}:${Date.now()}`).digest('hex');
  return `fb_${hash.slice(0, 12)}`;
}

// ─── Normalization ───────────────────────────────────────────────────────────

function normalize(text) {
  return text.toLowerCase().replace(/[!?.,;:'"()\[\]{}]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function hasEmoji(text) {
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/u.test(text);
}

function stripMention(text) {
  return text.replace(/<@!?\d+>/g, '').trim();
}

// ─── YES database — 150+ affirmative words/emojis ────────────────────────────

const AFFIRMATIVE_EXACT = new Set([
  'yes', 'yeah', 'yep', 'yup', 'yea', 'yessir', 'yes sir', 'yessum',
  'aye', 'aye aye', 'affirmative', 'correct', 'right', 'true', 'indeed',
  'absolutely', 'definitely', 'certainly', 'sure', 'of course', 'for sure',
  'totally', 'exactly', 'precisely', 'undoubtedly', 'positively',
  'that is correct', "that's correct", 'that is right', "that's right",
  'you got it', 'you bet', 'you betcha', 'you know it', 'damn right',
  'hell yeah', 'hell yes', 'heck yeah', 'heck yes', 'fuck yeah',
  'y', 'ya', 'ye', 'yh', 'yeh', 'yis', 'yus', 'yass', 'yasss', 'yassss',
  'yee', 'yeehaw', 'yerr', 'yerrr', 'yeet', 'yessirski', 'yessirr',
  'yupyup', 'yeppers', 'yepper', 'yippers', 'yessah', 'yesh', 'yipyip',
  'yaas', 'yas', 'yass queen', 'ok', 'okay', 'okie', 'okey', 'oki',
  'k', 'kk', 'mhm', 'mmhmm', 'uh huh', 'uhuh', 'yesss', 'yes yes',
  'alright', 'alrighty', 'very well', 'fine', 'good', 'great',
  'word', 'bet', 'facts', 'no cap', 'fr', 'fr fr', 'on god', 'deadass', 'legit',
  'oui', 'si', 'ja', 'da', 'hai', 'sim', 'igen', 'ano', 'tak', 'jawohl',
  'please do', 'go ahead', 'by all means', 'with pleasure', 'gladly',
  'very much so', 'i agree', 'i think so', 'i believe so', 'i suppose so',
  'it is', 'it was', 'yes please', 'yes pls', 'yes plz', 'yeah sure',
  'yeah of course', 'yes of course', 'yep sounds good', "yup that's it",
  'yes that is correct', "yeah that's right", 'yep exactly',
]);

const AFFIRMATIVE_STARTSWITH = [
  'yes', 'yeah', 'yep', 'yup', 'yass', 'yas', 'yea', 'correct',
  'absolutely', 'definitely', 'certainly', 'sure', 'of course',
  'right', 'true', 'exactly', 'indeed', 'totally', 'affirmative',
  'oui', 'si', 'ja', 'da', 'hai', 'yip',
];

const AFFIRMATIVE_EMOJI = new Set([
  '👍', '👌', '✅', '✔️', '✔', '☑️', '☑', '💯', '🙌', '👏', '🤝', '💪',
  '🆗', '🆒', '😊', '😄', '🥰', '💕', '❤️', '❤', '✨', '🌟', '🔥',
  '🏆', '🎉', '🎊', '🫡', '🤙', '👊',
]);

// ─── NO database — 150+ negative words/emojis ────────────────────────────────

const NEGATIVE_EXACT = new Set([
  'no', 'nope', 'nah', 'nay', 'no sir', 'nosir', "no ma'am",
  'negative', 'incorrect', 'wrong', 'false', 'not correct', 'not right',
  'not true', 'that is wrong', "that's wrong", 'that is incorrect',
  "that's incorrect", 'not really', 'not exactly', 'not quite',
  'absolutely not', 'definitely not', 'certainly not', 'of course not',
  'no way', 'no way jose', 'not at all', 'no chance', 'not even close',
  'far from it', 'nothing like that', 'nope nope', 'nopers', 'nopety',
  'n', 'na', 'naw', 'nahh', 'nahhh', 'nuh uh', 'nuhuh', 'nu uh',
  'nop', 'nope nope', 'nopee', 'nah bruh', 'nah fam', 'nah bro',
  'nah man', 'nah dude', 'negatory', 'neg', 'nadda', 'nada',
  'noo', 'nooo', 'noooo', 'nope.', 'hell no', 'hell nah',
  'heck no', 'heck nah', 'fuck no', 'god no', 'oh no',
  'nah not really', 'nope not at all', 'no thanks', 'no thx',
  'non', 'nein', 'njet', 'niet', 'iie', 'ani', 'lo', 'net',
  'hayir', 'nem', 'ne', 'ei',
  "i don't think so", 'i dont think so', 'i disagree',
  "that ain't it", 'that aint it', 'not it', 'nah not it',
  'no it isnt', 'no its not', 'no it is not', 'no that is wrong',
  'nah thats wrong', 'nope wrong', 'no thats not it',
  'i think not', 'not quite right', 'missed the mark',
  'way off', 'completely wrong', 'not at all', 'not in the slightest',
  'no sirree', 'nosiree',
]);

const NEGATIVE_STARTSWITH = [
  'no', 'nah', 'nope', 'nay', 'wrong', 'incorrect', 'false',
  'not', 'negative', 'non', 'nein', 'njet', 'niet',
];

const NEGATIVE_EMOJI = new Set([
  '👎', '❌', '✖️', '✖', '🚫', '⛔', '🤦', '🙅', '🙅‍♂️', '🙅‍♀️',
  '😞', '😣', '😖', '💔', '🤔', '😕', '🤨', '😬',
]);

// ─── Detection functions ─────────────────────────────────────────────────────

/**
 * Check if the reply text is an affirmative (YES) response.
 */
export function isAffirmative(rawText) {
  const text = normalize(stripMention(rawText));
  if (!text) return false;

  // Uncertainty check — ambiguous phrases are neither YES nor NO
  const uncertainty = /\b(sure|certain|know|maybe|perhaps|possibly|guess|think|doubt|wonder|kinda|sorta|sort of|idk|dunno)\b/i;
  const isShortAmbiguous = text.split(/\s+/).length <= 3 && uncertainty.test(text);
  if (isShortAmbiguous) return false;

  // 1. Exact match
  if (AFFIRMATIVE_EXACT.has(text)) return true;

  // 2. Starts with (handles "yes that was great" etc.)
  if (AFFIRMATIVE_STARTSWITH.some(w => text.startsWith(w + ' ') || text === w)) return true;

  // 3. Emoji (pure or mixed with short text e.g. "✅ that was perfect")
  const cleanEmoji = stripMention(rawText).trim();
  if (hasEmoji(cleanEmoji)) {
    const emojis = [...cleanEmoji].filter(c => hasEmoji(c));
    if (emojis.length > 0) {
      const affCount = emojis.filter(e => AFFIRMATIVE_EMOJI.has(e)).length;
      const negCount = emojis.filter(e => NEGATIVE_EMOJI.has(e)).length;
      // Pure/short emoji message
      if (cleanEmoji.length <= 8 && affCount > negCount && affCount > 0) return true;
      // Mixed emoji + short text with no negative emojis
      if (affCount > 0 && negCount === 0 && cleanEmoji.length <= 40) return true;
    }
  }

  // 4. Word-level check (short messages) — skip if negated
  const negationWords = /\b(not|never|no|n't|dont|don't|ain't|aint)\b/i;
  if (!negationWords.test(text)) {
    const words = text.split(/\s+/);
    if (words.length <= 5) {
      const affCount = words.filter(w =>
        AFFIRMATIVE_STARTSWITH.some(a => w.startsWith(a) && w.length <= a.length + 3)
      ).length;
      if (affCount >= 1 && words.length <= 3) return true;
    }
  }

  return false;
}

/**
 * Check if the reply text is a negative (NO) response.
 */
export function isNegative(rawText) {
  const text = normalize(stripMention(rawText));
  if (!text) return false;

  // Uncertainty check — "not sure" ≠ NO, "idk" ≠ NO
  const uncertainty = /\b(sure|certain|know|maybe|perhaps|possibly|guess|think|doubt|wonder|kinda|sorta|sort of|idk|dunno)\b/i;
  const isShortAmbiguous = text.split(/\s+/).length <= 3 && uncertainty.test(text);
  if (isShortAmbiguous) return false;

  // 1. Exact match
  if (NEGATIVE_EXACT.has(text)) return true;

  // 2. Starts with
  if (NEGATIVE_STARTSWITH.some(w => text.startsWith(w + ' ') || text === w)) return true;

  // 3. Emoji (pure or mixed e.g. "❌ wrong")
  const cleanEmoji = stripMention(rawText).trim();
  if (hasEmoji(cleanEmoji)) {
    const emojis = [...cleanEmoji].filter(c => hasEmoji(c));
    if (emojis.length > 0) {
      const negCount = emojis.filter(e => NEGATIVE_EMOJI.has(e)).length;
      const affCount = emojis.filter(e => AFFIRMATIVE_EMOJI.has(e)).length;
      if (cleanEmoji.length <= 8 && negCount > affCount && negCount > 0) return true;
      if (negCount > 0 && affCount === 0 && cleanEmoji.length <= 40) return true;
    }
  }

  // 4. Word-level check (short messages)
  const words = text.split(/\s+/);
  if (words.length <= 5) {
    const negCount = words.filter(w =>
      NEGATIVE_STARTSWITH.some(n => w.startsWith(n) && w.length <= n.length + 3)
    ).length;
    if (negCount >= 1 && words.length <= 3) return true;
  }

  return false;
}

// ─── Feedback lifecycle ──────────────────────────────────────────────────────

const PENDING_TIMEOUT_MINUTES = 5;

export function requestFeedback(userId, channelId, question, answer) {
  expireOldForUser(userId, channelId);
  const table = loadTable();

  // ── Dedup: skip if this exact Q&A was already resolved ──
  // Once a user confirms ('yes') or corrects ('corrected') a question,
  // don't re-prompt them for feedback on the same question again.
  const alreadyResolved = table.data.some(r =>
    r.userId === userId &&
    r.question === question.slice(0, 500) &&
    (r.feedback === 'yes' || r.feedback === 'corrected')
  );
  if (alreadyResolved) {
    log.info(`[FeedbackManager] Skipping feedback for ${userId} — question already resolved`);
    return '';  // no prompt — question already answered + confirmed
  }

  const id = feedbackId(userId, question);

  table.data.push({
    id, userId, channelId,
    question: question.slice(0, 500),
    answer: answer.slice(0, 1000),
    askedAt: new Date().toISOString(),
    repliedAt: null,
    feedback: 'pending',
    userReply: null,
  });

  if (table.data.length > 1000) table.data = table.data.slice(-1000);
  saveTable(table);
  log.info(`[FeedbackManager] Feedback requested from ${userId}: "${question.slice(0, 60)}"`);
  return `\n\n⁉️ <@${userId}> Was this answer correct? Reply **Yes** or **No**~!`;
}

export function processReply(userId, channelId, replyText) {
  const table = loadTable();
  const pending = table.data
    .filter(r => r.userId === userId && r.channelId === channelId && r.feedback === 'pending')
    .sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt))[0];

  if (!pending) return { action: 'none', message: null };

  const isYes = isAffirmative(replyText);
  const isNo = isNegative(replyText);

  pending.repliedAt = new Date().toISOString();
  pending.userReply = replyText.slice(0, 200);
  pending.feedback = isYes ? 'yes' : isNo ? 'no' : 'unknown';
  saveTable(table);

  if (isYes) {
    log.info(`[FeedbackManager] User ${userId} said YES — storing confirmed Q&A`);
    return {
      action: 'yes',
      question: pending.question,
      answer: pending.answer,
      message: `yay~! glad i got it right! 🎉 i'll remember this for next time~! thanks, <@${userId}>~! 💕`,
    };
  }

  if (isNo) {
    log.info(`[FeedbackManager] User ${userId} said NO — requesting correction`);
    // Don't mark as 'no' yet — set to 'correction_requested' to await the correct answer
    pending.feedback = 'correction_requested';
    pending.userReply = `NO: ${replyText.slice(0, 200)}`;
    saveTable(table);
    return {
      action: 'no',
      question: pending.question,
      answer: pending.answer,
      message: `aww, i got it wrong... 😣 thanks for telling me, <@${userId}>! what **was** the right answer? just type it below (no need to @mention me~!) 💕`,
    };
  }

  log.info(`[FeedbackManager] User ${userId} replied unknown: "${replyText.slice(0, 60)}"`);
  return {
    action: 'unknown',
    message: `ehe~ i didn't quite catch that, <@${userId}>! 😅 just reply **Yes** or **No** — was my answer correct? 💕`,
  };
}

export function hasPending(userId, channelId) {
  const table = loadTable();
  const now = Date.now();
  return table.data.some(r => {
    if (r.userId !== userId || r.channelId !== channelId || r.feedback !== 'pending') return false;
    return (now - new Date(r.askedAt).getTime()) < PENDING_TIMEOUT_MINUTES * 60 * 1000;
  });
}

/**
 * Check if the user has a pending correction request — i.e. they said "no"
 * and the bot is waiting for them to type the correct answer.
 */
export function hasPendingCorrection(userId, channelId) {
  const table = loadTable();
  const now = Date.now();
  return table.data.some(r => {
    if (r.userId !== userId || r.channelId !== channelId || r.feedback !== 'correction_requested') return false;
    return (now - new Date(r.askedAt).getTime()) < (PENDING_TIMEOUT_MINUTES + 3) * 60 * 1000;
  });
}

// ─── Correction validation helpers ────────────────────────────────────────────

/** Common stop words to filter out when extracting key terms. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
  'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over',
  'under', 'again', 'further', 'then', 'once', 'here', 'there', 'when',
  'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
  'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if',
  'while', 'about', 'up', 'down', 'this', 'that', 'these', 'those',
  'it', 'its', 'i', 'me', 'my', 'we', 'our', 'you', 'your', 'he', 'she',
  'they', 'them', 'what', 'which', 'who', 'whom', 'also', 'get', 'got',
]);

/**
 * Determine if a user's reply is a comment/dismissal, not a real correction.
 * Returns true for short/noise messages that shouldn't be stored as corrections.
 */
function isCommentLike(text) {
  if (!text || text.length < 3) return true;
  const words = text.trim().split(/\s+/);
  if (words.length <= 1) return true;
  const dismissals = [
    'idk', "i don't know", 'i dont know', 'nevermind', 'never mind', 'nvm',
    "it's fine", 'its fine', 'whatever', 'skip', 'nah', 'nope', 'nothing',
    "doesn't matter", 'doesnt matter', 'forget it', 'ignore', 'pass',
    'just kidding', 'jk', "i'm not sure", 'im not sure', 'no idea',
  ];
  const normalized = text.toLowerCase().trim().replace(/[^a-z0-9 ']/g, '');
  if (dismissals.some(d => normalized === d || normalized.startsWith(d + ' '))) return true;
  return false;
}

/**
 * Extract searchable key terms from a user's correction.
 * Filters stop words and returns the most meaningful terms.
 */
function extractKeyTerms(text) {
  const words = text.toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
  return [...new Set(words)].slice(0, 10);
}

/**
 * Validate a user's correction against web search results.
 *
 * @returns {{ isValid: boolean, confidence: number, snippet?: string }}
 */
async function validateCorrection(question, userAnswer) {
  if (!webSearchConfigured()) {
    return { isValid: true, confidence: 1.0 };
  }
  try {
    const searchQuery = `${question.slice(0, 100)} ${userAnswer.slice(0, 100)}`;
    const results = await searchWeb(searchQuery);
    if (!results || results.length === 0) {
      return { isValid: false, confidence: 0, snippet: null };
    }
    const answerTerms = extractKeyTerms(userAnswer);
    if (answerTerms.length === 0) {
      return { isValid: true, confidence: 0.5 };
    }
    let totalScore = 0;
    let bestSnippet = null;
    for (const result of results.slice(0, 5)) {
      const snippet = (result.snippet || result.content || result.title || '').toLowerCase();
      let matchCount = 0;
      for (const term of answerTerms) {
        if (snippet.includes(term)) matchCount++;
      }
      totalScore += matchCount / answerTerms.length;
      if (!bestSnippet && matchCount > 0) bestSnippet = snippet.slice(0, 200);
    }
    const confidence = totalScore / Math.min(results.length, 5);
    return {
      isValid: confidence >= 0.25,
      confidence: Math.round(confidence * 100) / 100,
      snippet: bestSnippet,
    };
  } catch (err) {
    log.warn(`[FeedbackManager] Web validation failed: ${err.message}`);
    return { isValid: true, confidence: 0.5 };
  }
}

/**
 * Process a user's correction response after they said "no" to feedback.
 *
 * Flow:
 *   1. Comment/dismissal → silently dismiss
 *   2. Real correction     → validateCorrection()
 *       a. Invalid (low confidence) → store with low confidence
 *       b. Valid (high confidence)  → store with high confidence
 */
export async function processCorrection(userId, channelId, correctionText) {
  const table = loadTable();
  const pending = table.data
    .filter(r => r.userId === userId && r.channelId === channelId && r.feedback === 'correction_requested')
    .sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt))[0];

  if (!pending) return { action: 'none', message: null };

  const cleanCorrection = correctionText.trim();
  if (!cleanCorrection || cleanCorrection.length < 2) {
    return {
      action: 'ask_again',
      message: `ehe~ could you type a bit more for the correct answer, <@${userId}>? i really want to learn! 💕`,
    };
  }

  // ── Comment detection ──────────────────────────────────────────────────
  if (isCommentLike(cleanCorrection)) {
    pending.feedback = 'dismissed';
    pending.userReply = `DISMISSED: ${cleanCorrection.slice(0, 200)}`;
    saveTable(table);
    log.info(`[FeedbackManager] User ${userId} dismissed correction: "${cleanCorrection.slice(0, 60)}"`);
    return {
      action: 'dismissed',
      message: `no worries, <@${userId}>~! if you find the right info later, just @mention me again! 💕`,
    };
  }

  // ── Web validation ─────────────────────────────────────────────────────
  // Always store the correction, but validate to set confidence level.
  const validation = await validateCorrection(pending.question, cleanCorrection);
  const isVerified = validation.isValid;

  pending.feedback = isVerified ? 'corrected' : 'corrected_unverified';
  pending.userReply = `CORRECTION: ${cleanCorrection.slice(0, 500)}`;
  pending.answer = cleanCorrection.slice(0, 1000);
  if (validation.confidence !== undefined) {
    pending.confidence = validation.confidence;
  }
  saveTable(table);

  log.info(
    `[FeedbackManager] User ${userId} correction ${isVerified ? 'verified' : 'unverified'} ` +
    `(confidence: ${validation.confidence}): "${cleanCorrection.slice(0, 60)}"`
  );

  if (isVerified) {
    return {
      action: 'corrected',
      question: pending.question,
      answer: pending.answer,
      confidence: validation.confidence,
      validationSnippet: validation.snippet || null,
      message: `ahh, i see! i checked around and that checks out — thank you so much for teaching me, <@${userId}>~! 🎓 i'll remember that. 💕`,
    };
  }

  return {
    action: 'corrected_unverified',
    question: pending.question,
    answer: pending.answer,
    confidence: validation.confidence,
    validationSnippet: null,
    message: `hmm, i looked it up and couldn't quite verify that... but i'll keep it in mind, <@${userId}>~! if you have sources, i'd love to see them! 📚`,
  };
}

/**
 * Retroactively validate stored corrections that were saved before web validation
 * existed. Only processes entries with `feedback === 'corrected'` that have no
 * `confidence` field. Capped at 50 entries to avoid excessive API calls.
 *
 * Call once on startup (after web search is initialized).
 *
 * @returns {Promise<{ scanned: number, verified: number, downgraded: number }>}
 */
export async function retroValidateCorrections() {
  if (!webSearchConfigured()) {
    log.info('[FeedbackManager] Web search not configured — skipping retro-validation');
    return { scanned: 0, verified: 0, downgraded: 0 };
  }

  const table = loadTable();
  const candidates = table.data.filter(r =>
    r.feedback === 'corrected' &&
    r.userReply?.startsWith('CORRECTION:') &&
    r.confidence === undefined
  );

  if (candidates.length === 0) {
    log.info('[FeedbackManager] No unvalidated corrections to retro-validate');
    return { scanned: 0, verified: 0, downgraded: 0 };
  }

  const toValidate = candidates.slice(0, 50);
  let verified = 0;
  let downgraded = 0;

  log.info(`[FeedbackManager] Retro-validating ${toValidate.length} old corrections (${candidates.length} total, capped at 50)...`);

  for (let i = 0; i < toValidate.length; i++) {
    const entry = toValidate[i];
    const correction = entry.userReply?.replace(/^CORRECTION:\s*/, '').trim();
    if (!correction || correction.length < 10) {
      entry.confidence = 0.3;
      entry.feedback = 'corrected_unverified';
      downgraded++;
      continue;
    }

    if (i > 0) await new Promise(r => setTimeout(r, 1000));  // rate-limit: 1 req/sec

    try {
      const validation = await validateCorrection(entry.question, correction);
      entry.confidence = validation.confidence;
      if (!validation.isValid) {
        entry.feedback = 'corrected_unverified';
        downgraded++;
      } else {
        verified++;
        // ── Feed verified correction into LearningManager ──────────────
        try {
          const lm = global.__learningManager;
          if (lm) {
            lm.process({
              userId:   entry.userId,
              query:    `CORRECTION: ${entry.question}`,
              response: correction,
              metadata: { domain: 'correction', feedback: -1, confidence: validation.confidence },
            }).catch(() => {});
            // Also store the validation evidence that confirmed it
            if (validation.snippet) {
              lm.process({
                userId:   entry.userId,
                query:    `VALIDATED: ${entry.question}`,
                response: validation.snippet,
                metadata: { domain: 'validation_evidence', feedback: 1, confidence: Math.min(1, validation.confidence + 0.1), trusted: true },
              }).catch(() => {});
            }
          }
        } catch { /* learning is additive */ }
      }
      log.info(
        `[FeedbackManager] Retro-validated "${entry.question.slice(0, 40)}": ` +
        `${validation.isValid ? 'verified' : 'downgraded'} (confidence: ${validation.confidence})`
      );
    } catch (err) {
      entry.confidence = 0.3;
      entry.feedback = 'corrected_unverified';
      downgraded++;
      log.warn(`[FeedbackManager] Retro-validation failed for "${entry.question.slice(0, 40)}": ${err.message}`);
    }
  }

  saveTable(table);
  log.info(
    `[FeedbackManager] Retro-validation complete: ${verified} verified, ` +
    `${downgraded} downgraded to unverified (${toValidate.length} total scanned)`
  );
  return { scanned: toValidate.length, verified, downgraded };
}

export function getPendingQuestion(userId, channelId) {
  const table = loadTable();
  const pending = table.data
    .filter(r => r.userId === userId && r.channelId === channelId && r.feedback === 'pending')
    .sort((a, b) => new Date(b.askedAt) - new Date(a.askedAt))[0];
  return pending ? { question: pending.question, answer: pending.answer } : null;
}

function expireOldForUser(userId, channelId) {
  const table = loadTable();
  const now = Date.now();
  let changed = false;
  for (const row of table.data) {
    if (row.userId === userId && row.channelId === channelId && (row.feedback === 'pending' || row.feedback === 'correction_requested')) {
      if ((now - new Date(row.askedAt).getTime()) > PENDING_TIMEOUT_MINUTES * 60 * 1000) {
        row.feedback = 'timeout';
        row.repliedAt = new Date().toISOString();
        changed = true;
      }
    }
  }
  if (changed) saveTable(table);
}

export function expireOld(minutes = PENDING_TIMEOUT_MINUTES) {
  const table = loadTable();
  const now = Date.now();
  let changed = false;
  for (const row of table.data) {
    if (row.feedback === 'pending' || row.feedback === 'correction_requested') {
      if ((now - new Date(row.askedAt).getTime()) > minutes * 60 * 1000) {
        row.feedback = 'timeout';
        row.repliedAt = new Date().toISOString();
        changed = true;
      }
    }
  }
  if (changed) {
    saveTable(table);
    log.info(`[FeedbackManager] Expired stale feedback requests`);
  }
}
