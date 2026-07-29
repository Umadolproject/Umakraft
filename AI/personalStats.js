// AI/personalStats.js
// Live fan-data lookup for #bot-chat @mention queries like "how many fans do I have?"
//
// Flow: Discord user → getLinkByDiscordId → trainerId → retrieve Depot product → text reply
//
// Reuses the same data layer the /fan_gain slash command uses, but returns
// a personality-rich text summary instead of an image card.

import { getLinkByDiscordId, getLinkByTrainerName, listLinks } from '../Distribution/Coordinator/utils/memberLinks.js';
import { retrieve }            from '../Refinery/Depot/depot.js';
import { createLogger }        from '../core/pipelineLogger.js';
import { getByName as getTrainerByName } from '../Distribution/Coordinator/utils/trainerDb.js';

const logger = createLogger('personalStats');

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

function fmtDiff(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
}

// ─── Period / embed helpers ───────────────────────────────────────────────────

const PERIOD_LABEL = { daily: "Today's Gains", weekly: 'This Week', monthly: 'This Month', lifetime: 'Lifetime' };
const PERIOD_EMOJI = { daily: '📈', weekly: '📅', monthly: '📆', lifetime: '🏆' };

/**
 * Parse the intended time period from a free-text query. Defaults to 'daily'.
 * @param {string} query
 * @returns {'daily'|'weekly'|'monthly'|'lifetime'}
 */
function parsePeriod(query) {
  const lower = query.toLowerCase();
  if (/\b(monthly|month|this\s+month)\b/.test(lower))                  return 'monthly';
  if (/\b(weekly|week|this\s+week)\b/.test(lower))                     return 'weekly';
  if (/\b(lifetime|all[\s-]time|alltime|overall|total\s+fans?)\b/.test(lower)) return 'lifetime';
  return 'daily';
}

/**
 * Format a number as a signed gain string, e.g. +1,234,567 or −800,000.
 */
function fmtGainVal(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
}

/**
 * Format an unsigned number compactly for embed footers / secondary fields.
 */
function fmtCompact(n) {
  if (n == null) return '—';
  const abs = Math.abs(Number(n));
  if (abs >= 1_000_000_000) return `${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000)     return `${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)         return `${(abs / 1_000).toFixed(1)}K`;
  return abs.toLocaleString('en-US');
}

/**
 * Extract up to two trainer names from plain text (no Discord @mentions needed).
 * Handles: "between X and Y", "X vs Y", "gap of fans X to Y".
 */
function extractTextNames(query) {
  const stripped = query.replace(/<@!?\d+>/g, '').replace(/[?!.,]/g, '').trim();
  const lower    = stripped.toLowerCase();

  // "between X and Y"
  const between = lower.match(/between\s+(.+?)\s+and\s+(.+)/);
  if (between) return [between[1].trim(), between[2].trim()];

  // "X vs Y" / "X versus Y" — strip leading noise
  const vs = lower.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/);
  if (vs) {
    const a = vs[1].replace(/^(?:the\s+)?(?:gap|difference)(?:\s+of\s+fans?)?\s+/i, '').trim();
    const b = vs[2].trim();
    if (a && b) return [a, b];
  }

  // "gap/difference … X to Y"
  const to = lower.match(/(?:gap|difference)(?:\s+of\s+fans?)?\s+(.+?)\s+to\s+(.+)/);
  if (to) return [to[1].trim(), to[2].trim()];

  return [];
}

// ─── Trainer data resolution ──────────────────────────────────────────────────

/**
 * Resolve a trainer ID directly to Depot fan data.
 */
async function resolveDepotData(trainerId, fallbackName) {
  const { product } = await retrieve(trainerId);
  if (!product?.compiledProduct) {
    return { trainerName: fallbackName, trainerId, noData: true };
  }
  const cp   = product.compiledProduct;
  const meta = cp.meta ?? {};
  const fans = cp.fans ?? {};
  return {
    trainerName: meta.trainerName ?? fallbackName ?? trainerId,
    trainerId,
    lifetime: fans.lifetime,
    daily:    fans.daily,
    weekly:   fans.weekly,
    monthly:  fans.monthly,
    rank:     cp.rank,
    storedAt: product.storedAt,
  };
}

/**
 * Resolve a Discord user to their trainer data from the Depot.
 * Returns data object or null if not linked.
 */
async function resolveTrainerData(discordId, guildId) {
  const link = await getLinkByDiscordId(discordId, guildId);
  if (!link) return null;
  return resolveDepotData(link.trainerId, link.trainerName);
}

/**
 * Resolve a trainer by name — checks member_links (case-insensitive) then the
 * local trainer DB (exact match). Returns data object or { notFound: true, name }.
 */
async function resolveTrainerDataByName(name, guildId) {
  // 1. member_links
  const link = await getLinkByTrainerName(name, guildId);
  if (link) return resolveDepotData(link.trainerId, link.trainerName);

  // 2. Local trainer DB
  try {
    const dbEntry = await getTrainerByName(name);
    if (dbEntry?.trainer_id) {
      return resolveDepotData(dbEntry.trainer_id, dbEntry.trainer_name ?? name);
    }
  } catch { /* trainer DB unavailable */ }

  return { notFound: true, name };
}

/**
 * Look up a Discord user's linked trainer and return a formatted fan summary.
 *
 * @param {string} discordId
 * @param {string} guildId
 * @returns {Promise<{ success: boolean, content?: string, linkRequired?: boolean }>}
 */
export async function getStats(discordId, guildId) {
  const data = await resolveTrainerData(discordId, guildId);

  if (!data) {
    return {
      success: false,
      linkRequired: true,
      content: [
        "aww, i don't know who you are yet, trainer... 🥺💕",
        '',
        "ask an admin to `/link` your Discord to your uma.moe account and then i can tell you everything about your fans~! once you're linked i'll remember you forever~! ✨",
      ].join('\n'),
    };
  }

  if (data.noData) {
    logger.warn(`No depot product for trainer ${data.trainerId} (${data.trainerName})`);
    return {
      success: false,
      linkRequired: false,
      content: [
        `oh! i found you, **${data.trainerName}**! 👋`,
        '',
        "but... i don't have your latest fan numbers yet 😢 try running `/fan_gain` and then come ask me again — i'll have your stats ready in seconds~! 💕",
      ].join('\n'),
    };
  }

  // Build warm, conversational reply
  const lines = [];
  const name = data.trainerName;
  
  // Personalized greeting based on daily gain
  if (data.daily != null) {
    if (data.daily >= 2_000_000) {
      lines.push(`${name}~! wow you're on FIRE today! 🔥🔥🔥`);
    } else if (data.daily >= 1_000_000) {
      lines.push(`${name}~! looking strong today! 💪✨`);
    } else if (data.daily >= 500_000) {
      lines.push(`${name}~! steady pace, keep it up! 📈💕`);
    } else if (data.daily >= 100_000) {
      lines.push(`${name}~! here's where you're at~! 😊`);
    } else if (data.daily >= 0) {
      lines.push(`${name}~! hmm, slow day so far... let's check! 😅`);
    } else {
      lines.push(`${name}~! checking in on your stats~! 💕`);
    }
  } else {
    lines.push(`here you go, ${name}~! 🏇✨`);
  }
  lines.push('');

  if (data.lifetime != null) {
    lines.push(`🏆 **Total Fans**: ${fmt(data.lifetime)}`);
  }
  if (data.daily != null) {
    const emoji = data.daily >= 1_000_000 ? '🔥' : data.daily >= 500_000 ? '💪' : data.daily >= 100_000 ? '📈' : '😅';
    lines.push(`📊 **Today**: ${fmtDiff(data.daily)} ${emoji}`);
  }
  if (data.weekly != null) {
    lines.push(`📅 **This Week**: ${fmtDiff(data.weekly)}`);
  }
  if (data.monthly != null) {
    const goalMet = data.monthly >= 30_000_000;
    const mEmoji  = goalMet ? '✅' : '⚠️';
    lines.push(`📆 **This Month**: ${fmtDiff(data.monthly)} ${mEmoji} ${goalMet ? 'On pace~!' : 'Keep pushing!'}`);
  }
  if (data.rank != null) {
    const rankEmoji = data.rank <= 10 ? '👑' : data.rank <= 50 ? '⭐' : data.rank <= 100 ? '💫' : '🌱';
    lines.push(`📊 **Circle Rank**: #${data.rank} ${rankEmoji}`);
  }

  // Daily goal check — encouraging tone
  if (data.daily != null && data.daily < 1_000_000) {
    const remaining = (1_000_000 - data.daily).toLocaleString('en-US');
    lines.push('');
    lines.push(`💡 **${remaining} fans** to 1M today — you got this! 💕`);
  }

  // Closing encouragement
  if (data.daily != null && data.daily >= 1_000_000) {
    lines.push('');
    lines.push(`keep going strong, ${name}~! ganbatte! 🏇💕`);
  }

  // Freshness note — friendly
  if (data.storedAt) {
    const age = Math.round((Date.now() - new Date(data.storedAt).getTime()) / 60000);
    if (age > 60) {
      lines.push('');
      lines.push(`📌 _synced ${age}m ago — "/fan_gain" refreshes it~_`);
    }
  }

  return { success: true, content: lines.join('\n') };
}

// ─── Fan comparison (two trainers) ───────────────────────────────────────────

/**
 * Build a Discord embed for a two-trainer fan comparison.
 *
 * @param {object} dataA   — resolved trainer data for subject A
 * @param {string} displayA — display label for A ("You", "@username", or trainer name)
 * @param {object} dataB
 * @param {string} displayB
 * @param {'daily'|'weekly'|'monthly'|'lifetime'} period — primary comparison period
 * @returns {object} Discord embed object
 */
function buildComparisonEmbed(dataA, displayA, dataB, displayB, period) {
  const nameA = `${displayA} (${dataA.trainerName})`;
  const nameB = `${displayB} (${dataB.trainerName})`;
  const fields = [];

  // ── Primary period (full-width, most prominent) ──────────────────────────
  const valA = dataA[period];
  const valB = dataB[period];

  if (valA != null && valB != null) {
    const diff   = valA - valB;
    const leader = diff > 0 ? displayA : diff < 0 ? displayB : null;
    const gapLine = leader
      ? `\n📏 **${leader}** ahead by **${fmtCompact(Math.abs(diff))}**`
      : '\n✨ Exactly tied!';

    fields.push({
      name:   `${PERIOD_EMOJI[period]} ${PERIOD_LABEL[period]}`,
      value:  `**${nameA}**: ${fmtGainVal(valA)}\n**${nameB}**: ${fmtGainVal(valB)}${gapLine}`,
      inline: false,
    });
  } else {
    fields.push({
      name:   `${PERIOD_EMOJI[period]} ${PERIOD_LABEL[period]}`,
      value:  `**${nameA}**: ${valA != null ? fmtGainVal(valA) : '—'}\n**${nameB}**: ${valB != null ? fmtGainVal(valB) : '—'}\n_Not enough data to compare_`,
      inline: false,
    });
  }

  // ── Secondary periods (inline pairs) ─────────────────────────────────────
  const secondaryPeriods = ['daily', 'weekly', 'monthly', 'lifetime'].filter(p => p !== period);
  const secondaryFields  = [];

  for (const p of secondaryPeriods) {
    const a = dataA[p];
    const b = dataB[p];
    if (a == null && b == null) continue;

    const isGain = p !== 'lifetime';
    const fmtA = isGain ? fmtGainVal(a) : (a != null ? fmt(a) : '—');
    const fmtB = isGain ? fmtGainVal(b) : (b != null ? fmt(b) : '—');

    secondaryFields.push({
      name:   `${PERIOD_EMOJI[p]} ${PERIOD_LABEL[p]}`,
      value:  `**${displayA}**: ${fmtA}\n**${displayB}**: ${fmtB}`,
      inline: true,
    });
  }

  // Pad inline fields to groups of 3 (Discord renders 3-per-row)
  while (secondaryFields.length % 3 !== 0) {
    secondaryFields.push({ name: '\u200b', value: '\u200b', inline: true });
  }
  fields.push(...secondaryFields);

  // ── Ranks ─────────────────────────────────────────────────────────────────
  if (dataA.rank != null || dataB.rank != null) {
    fields.push({
      name:   '📊 Circle Rank',
      value:  `**${displayA}**: ${dataA.rank != null ? `#${dataA.rank}` : '—'}\n**${displayB}**: ${dataB.rank != null ? `#${dataB.rank}` : '—'}`,
      inline: true,
    });
  }

  // ── Freshness footer ──────────────────────────────────────────────────────
  const ages = [];
  for (const [d, label] of [[dataA, displayA], [dataB, displayB]]) {
    if (d.storedAt) {
      const age = Math.round((Date.now() - new Date(d.storedAt).getTime()) / 60000);
      if (age > 60) ages.push(`${label}: ${age}m ago`);
    }
  }

  return {
    title:       `📊 Fan Comparison — ${PERIOD_LABEL[period]}`,
    description: `**${nameA}** vs **${nameB}**`,
    color:       0x5865F2,
    fields,
    footer:      { text: ages.length > 0 ? `⏱ ${ages.join(' · ')} — /fan_gain to refresh` : 'UmaKraft · fan comparison' },
    timestamp:   new Date().toISOString(),
  };
}

/**
 * Compare fan gains between two trainers.
 * Subjects are resolved from Discord @mentions, self-references ("me"), or
 * plain trainer names extracted from the query text.
 *
 * @param {string}          discordIdA — Discord ID of the message author
 * @param {string}          guildId
 * @param {string}          query      — cleaned message text
 * @param {Map|Collection}  mentions   — Discord message.mentions.users
 * @returns {Promise<{ success: boolean, embed?: object, content?: string }>}
 */
export async function compareStats(discordIdA, guildId, query, mentions) {
  const lower          = query.toLowerCase();
  const mentionedUsers = mentions ? [...mentions.values()] : [];
  const period         = parsePeriod(query);

  // ── Subject resolution ────────────────────────────────────────────────────
  // Types: { kind: 'discord', discordId, display }
  //        { kind: 'name',    name,      display }
  //        { kind: 'self',    discordId, display }

  let subjectA = null;
  let subjectB = null;

  const hasSelfRef   = /\b(me|my|mine|i)\b/i.test(lower);
  const isObjectMe   = /\b(show|tell|give|let|gimme|lemme|pull|rank|list|sort|compare|send|display)\s+me\b/i.test(lower);
  const effectiveSelf = hasSelfRef && !isObjectMe;

  if (effectiveSelf && mentionedUsers.length === 1) {
    // Me vs @mention
    subjectA = { kind: 'self',    discordId: discordIdA,         display: 'You'                       };
    subjectB = { kind: 'discord', discordId: mentionedUsers[0].id, display: `@${mentionedUsers[0].username}` };
  } else if (mentionedUsers.length >= 2) {
    // @A vs @B
    subjectA = { kind: 'discord', discordId: mentionedUsers[0].id, display: `@${mentionedUsers[0].username}` };
    subjectB = { kind: 'discord', discordId: mentionedUsers[1].id, display: `@${mentionedUsers[1].username}` };
  } else if (mentionedUsers.length === 1 && !effectiveSelf) {
    // Implied self + @mention
    subjectA = { kind: 'self',    discordId: discordIdA,         display: 'You'                       };
    subjectB = { kind: 'discord', discordId: mentionedUsers[0].id, display: `@${mentionedUsers[0].username}` };
  } else {
    // No @mentions — try to extract trainer names from text
    const textNames = extractTextNames(query);

    if (textNames.length >= 2) {
      const [rawA, rawB] = textNames;
      const selfA = /^(me|my|mine|myself|i)$/i.test(rawA);
      const selfB = /^(me|my|mine|myself|i)$/i.test(rawB);

      subjectA = selfA
        ? { kind: 'self', discordId: discordIdA, display: 'You' }
        : { kind: 'name', name: rawA, display: rawA };
      subjectB = selfB
        ? { kind: 'self', discordId: discordIdA, display: 'You' }
        : { kind: 'name', name: rawB, display: rawB };
    } else if (textNames.length === 1 && effectiveSelf) {
      subjectA = { kind: 'self', discordId: discordIdA, display: 'You' };
      subjectB = { kind: 'name', name: textNames[0], display: textNames[0] };
    } else {
      // No subjects found — fall back to personal stats
      return getStats(discordIdA, guildId);
    }
  }

  // Prevent self-vs-self
  if (subjectA.kind !== 'name' && subjectB.kind !== 'name' &&
      subjectA.discordId === subjectB.discordId) {
    return {
      success: false,
      content: "ehe~ that's... just you! 😂 want to compare with someone else? mention them or tell me their trainer name~! 💕",
    };
  }

  // ── Resolve trainer data ──────────────────────────────────────────────────
  async function resolveSubject(subject) {
    if (subject.kind === 'name') return resolveTrainerDataByName(subject.name, guildId);
    return resolveTrainerData(subject.discordId, guildId);
  }

  const [dataA, dataB] = await Promise.all([
    resolveSubject(subjectA),
    resolveSubject(subjectB),
  ]);

  const displayA = subjectA.display;
  const displayB = subjectB.display;

  // ── Error responses (text, no embed needed) ───────────────────────────────
  if (!dataA || dataA.notFound) {
    return { success: false, content: `hmm... I couldn't find trainer **"${subjectA.kind === 'name' ? subjectA.name : displayA}"**... 😣 are they linked? try mentioning them with @~! 💕` };
  }
  if (!dataB || dataB.notFound) {
    return { success: false, content: `hmm... I couldn't find trainer **"${subjectB.kind === 'name' ? subjectB.name : displayB}"**... 😣 are they linked? try mentioning them with @~! 💕` };
  }
  if (dataA.noData && dataB.noData) {
    return { success: false, content: `neither **${displayA}** nor **${displayB}** have fan data yet... 😢 both try \`/fan_gain\` first~! 💕` };
  }
  if (dataA.noData) {
    return { success: false, content: `**${displayA}** (${dataA.trainerName}) has no fan data yet... 😢 try \`/fan_gain\` first~!` };
  }
  if (dataB.noData) {
    return { success: false, content: `**${displayB}** (${dataB.trainerName}) has no fan data yet... 😢 try \`/fan_gain\` first~!` };
  }

  // ── Build embed ───────────────────────────────────────────────────────────
  const embed = buildComparisonEmbed(dataA, displayA, dataB, displayB, period);
  return { success: true, embed };
}

/**
 * Quick check: does the query look like someone asking about their own stats?
 * Used by messageCreate.js to bypass the AI pipeline.
 *
 * IMPORTANT: comparison queries ("me vs @member", "@A vs @B") should NOT match here —
 * they are handled by compareStats instead. Comparison queries include mentions.
 */
export function isPersonalStatsQuery(query) {
  const lower = query.toLowerCase().replace(/[?!.]+$/, '').trim();

  // Don't match if it looks like a comparison or leaderboard query
  if (isComparisonQuery(query) || isMultiComparison(query) || isLeaderboardQuery(query)) return false;

  // Don't match if it mentions other trainers (comparison-like)
  const hasMention = /<@!?\d+>/.test(query);
  if (hasMention) return false;

  // Self-reference — explicit (i, my, me) or implicit (no other subject mentioned)
  const isSelfReferential = /\b(i|my|me|mine|myself|i'm|im|i've|ive|i'd)\b/i.test(lower);
  // Implicit: fan queries without a subject ("how many fans today" → my fans)
  const hasOtherPerson = /\b(he|she|they|them|their|his|her|him|everyone|anyone|somebody|someone)\b/i.test(lower);
  const isImpliedSelf = !isSelfReferential && !hasOtherPerson && !hasMention;

  if (!isSelfReferential && !isImpliedSelf) return false;

  // Broad fan/stats reference check
  const isFanRelated = /\b(fans?|fan\s*(count|gain|points?|stats?|rank|growth)|gain|stats?|rank|circle|progress|doing|performing|trainer|looking|position|place|standing)\b/i.test(lower);
  if (!isFanRelated) return false;

  // Must look like a question or request
  const isQuestionLike = /\b(how|hows|what|whats|who|tell|show|check|give|update|status|look|want|know|wanna|see|lets|gimme|lemme|sup|yo|ayo|hey|could|am\s+i|are\s+my|do\s+i|can\s+(you|u)|please|let\s+me)\b/i.test(lower) 
    || lower.includes('?')
    || /\bmy\s+(daily|weekly|monthly|total|lifetime|fan|current|trainer|circle|rank|progress|stats?|gain)\b/i.test(lower);
  if (!isQuestionLike) return false;

  // Exclude queries that are clearly asking about game mechanics, not personal stats
  const isGameMechanic = /\b(meaning|means?|define|how\s+(does|to|do|can|should)\s+|what\s+is\s+(a\s+|the\s+)?(mant|fan\s*gain|fan\s*deficit|circle\s*rank|trend\s*tier))\b/i.test(lower);
  if (isGameMechanic) return false;

  return true;
}

/**
 * Quick check: does the query look like a fan comparison between two trainers?
 * Only returns true for 2-subject comparisons. For 3+, see isMultiComparison.
 * Must be checked BEFORE isPersonalStatsQuery to avoid false matches.
 */
export function isComparisonQuery(query) {
  const lower = query.toLowerCase().replace(/[?!.]+$/, '').trim();

  // If 3+ subjects, let isMultiComparison handle it
  if (countComparisonSubjects(query) >= 3) return false;

  // Must have mentions OR explicit comparison keywords
  const hasMention = /<@!?\d+>/.test(query);
  const hasSelf = /\b(me|my|mine|us)\b/i.test(lower) || /\bi\s+(have|got|am|want)\b/i.test(lower);
  // "me" as object pronoun is NOT a subject
  const isObjectMe = /\b(show|tell|give|let|gimme|lemme|pull|rank|list|sort|compare|send|display)\s+me\b/i.test(lower);
  const effectiveSelf = hasSelf && !isObjectMe;

  // Strong keywords: always trigger comparison (these inherently compare two things)
  const hasStrongKeyword = /\b(difference|compar(ed?|ison|ing)|vs\.?|versus|ahead|behind|gap|closer\s+to|beat(ing)?|catch(ing)?\s+up|overtak(ing|e)?|surpass(ing)?|pass(ing)?|outperform(ing)?|battle|face\s+off|side\s+by\s+side|rank\s+(us|them|these)|better\s+trainer|bigger\s+trainer)\b/i.test(lower);

  // Weak keywords: only trigger when subjects are identified (mentions or self-ref)
  const hasWeakKeyword = /\b(who\s+(has|got|have|is|the|da)|which\s+(one|of|trainer)|whose|more\s+fans|less\s+fans|winning|losing|fan\s+(battle|war|face\s+off))\b/i.test(lower);

  const hasCompareKeyword = hasStrongKeyword || (hasWeakKeyword && (hasMention || effectiveSelf));

  if (!hasMention && !hasCompareKeyword) return false;

  // Fan-related context: required when no mentions, relaxed when @mentions exist
  // (in #bot-chat, @mentions are virtually always trainer references)
  const isFanRelated = hasMention || /\b(fans?|fan\s*(count|gain|base|war|battle|face)|stats?|rank(ed|ing)?|compare|comparison|higher|lower|more|less|most|least|gap|difference)\b/i.test(lower);
  if (!isFanRelated) return false;

  return true;
}

// ─── Multi-person comparison (3–30 trainers) ─────────────────────────────────

/**
 * Count how many distinct subjects are in a comparison query.
 * Subjects = asker (if "me/my/i" used) + all distinct @mentions.
 * Returns 999 if @everyone or @here is used (signals full-circle comparison).
 */
function countComparisonSubjects(query) {
  const lower = query.toLowerCase();

  // @everyone / @here → full circle
  if (/@everyone|@here/i.test(query)) return 999;

  // "all of us", "everyone here", "compare us", "which of us" → implicit multi
  if (/\b(all\s+of\s+us|everyone\s+here|us\s+all|compare\s+us|rank\s+us|which\s+of\s+us|among\s+us|out\s+of\s+us)\b/i.test(lower)) return 999;

  const mentionMatches = query.match(/<@!?\d+>/g) || [];
  const distinctIds = new Set(mentionMatches.map(m => m.replace(/[<@!>]/g, '')));

  // "me" as object pronoun ("show me", "tell me", "give me") is NOT a subject
  const isObjectMe = /\b(show|tell|give|let|gimme|lemme|pull|rank|list|sort|compare|send|display)\s+me\b/i.test(lower);
  const hasSelf = !isObjectMe && (/\b(me|my|mine)\b/i.test(lower) || /\bi\s+(have|got|am|want|need)\b/i.test(lower));

  return distinctIds.size + (hasSelf ? 1 : 0);
}

/**
 * Detect 3+ person fan comparisons.
 */
export function isMultiComparison(query) {
  const subjectCount = countComparisonSubjects(query);
  if (subjectCount < 3) return false;

  const lower = query.toLowerCase();
  const isEveryone = /@everyone|@here/i.test(query);
  const hasFanKeyword = /\b(fans?|fan\s*(count|gain|base|battle|war)|stats?|rank(ing|ed)?|compare|compar|vs\.?|versus|difference|leaderboard|who\s+has|top|most|least|among|listing|list|show|sort|by\s+fan|fan\s+comparison|fan\s+ranking|everyone|all\s+of\s+us|our\s+fans|how\s+do\s+we|who\s+is\s+(first|number|top|#|winning|the\s+best|leading)|side\s+by\s+side|face\s+off|how\s+many\s+fans\s+does)\b/i.test(lower);

  // @everyone / @here MUST have fan context to avoid false positives
  if (isEveryone) return hasFanKeyword;

  // 3+ regular mentions: always a comparison in #bot-chat context
  return hasFanKeyword || subjectCount >= 3;
}

/**
 * Compare fan gains across 3–30 trainers, returning a ranked embed.
 * Period is detected from the query; defaults to daily.
 */
export async function compareMulti(discordId, guildId, query, mentions) {
  const MAX_TRAINERS  = 30;
  const lower         = query.toLowerCase();
  const mentionedUsers = mentions ? [...mentions.values()] : [];
  const period        = parsePeriod(query);

  // ── Collect subjects ───────────────────────────────────────────────────
  const subjects = [];
  const seen     = new Set();
  const isEveryone = /@everyone|@here/i.test(query);

  if (isEveryone) {
    const { links } = await listLinks(guildId, { limit: MAX_TRAINERS });
    for (const link of links) {
      if (!seen.has(link.discordId)) {
        seen.add(link.discordId);
        subjects.push({ discordId: link.discordId, displayName: link.trainerName });
      }
    }
  } else {
    const hasSelf = /\b(me|my|mine)\b/i.test(lower) || /\bi\s+(have|got|am|want|need)\b/i.test(lower);
    if (hasSelf && !seen.has(discordId)) {
      seen.add(discordId);
      subjects.push({ discordId, displayName: 'You' });
    }
    for (const user of mentionedUsers) {
      if (!seen.has(user.id)) {
        seen.add(user.id);
        subjects.push({ discordId: user.id, displayName: `@${user.username}` });
      }
    }
  }

  const capped = subjects.slice(0, MAX_TRAINERS);
  if (capped.length === 0) {
    return { success: false, content: "hmm... i don't see anyone to compare! 😅 mention the trainers~! 💕" };
  }

  // ── Resolve all in parallel ────────────────────────────────────────────
  const results = await Promise.all(capped.map(async (s) => {
    const data = await resolveTrainerData(s.discordId, guildId);
    return { subject: s, data };
  }));

  const ranked    = [];
  const noData    = [];
  const notLinked = [];

  for (const r of results) {
    if (!r.data)            notLinked.push(r.subject);
    else if (r.data.noData) noData.push({ displayName: r.subject.displayName, name: r.data.trainerName });
    else                    ranked.push({ displayName: r.subject.displayName, ...r.data });
  }

  // Sort by the requested period descending (fall back to lifetime)
  ranked.sort((a, b) => ((b[period] ?? b.lifetime ?? 0) - (a[period] ?? a.lifetime ?? 0)));

  // ── Build embed description (ranked list) ─────────────────────────────
  const total   = capped.length;
  const medals  = ['🥇', '🥈', '🥉'];
  const topVal  = ranked[0]?.[period] ?? ranked[0]?.lifetime ?? 0;
  const isGain  = period !== 'lifetime';

  let description = '';
  if (ranked.length === 0) {
    description = notLinked.length > 0
      ? `No one is linked yet — ${notLinked.map(s => s.displayName).join(', ')} need \`/link\`~!`
      : 'No fan data yet — everyone try `/fan_gain` first~! 💕';
  } else {
    const lines = ranked.map((r, i) => {
      const posLabel = medals[i] ?? `${String(i + 1).padStart(2, ' ')}.`;
      const val      = r[period] ?? r.lifetime;
      const valStr   = isGain ? fmtGainVal(val) : fmtCompact(val);
      const gap      = i > 0 && topVal > 0 && val != null ? val - topVal : null;
      const gapStr   = gap != null && gap !== 0
        ? ` _(${fmtCompact(Math.abs(gap))} behind)_`
        : '';
      return `${posLabel} **${r.displayName}** (${r.trainerName}): ${valStr}${gapStr}`;
    });

    description = lines.join('\n');
    // Discord embed description cap: 4096 chars
    if (description.length > 3900) {
      const cutoff = description.lastIndexOf('\n', 3850);
      description  = description.slice(0, cutoff > 0 ? cutoff : 3850);
      description += '\n\n_...truncated — use `/leaderboard` for the full list~_ 😅';
    }
  }

  // ── Warnings field ────────────────────────────────────────────────────
  const fields = [];
  const warnParts = [];
  if (notLinked.length > 0) warnParts.push(`🔗 Not linked: ${notLinked.map(s => s.displayName).join(', ')}`);
  if (noData.length   > 0) warnParts.push(`📭 No data: ${noData.map(n => n.displayName).join(', ')}`);
  if (warnParts.length > 0) {
    fields.push({ name: '⚠️ Warnings', value: warnParts.join('\n'), inline: false });
  }

  // ── Freshness footer ─────────────────────────────────────────────────
  const maxAge = ranked.length > 0
    ? Math.max(...ranked.map(r => r.storedAt
        ? Math.round((Date.now() - new Date(r.storedAt).getTime()) / 60000)
        : 0))
    : 0;

  const footerText = isEveryone
    ? `Circle comparison · ${ranked.length} of ${total} trainers${maxAge > 60 ? ` · oldest data ${maxAge}m ago — /fan_gain to refresh` : ''}`
    : `${ranked.length} of ${total} trainers${maxAge > 60 ? ` · oldest data ${maxAge}m ago — /fan_gain to refresh` : ''}`;

  const embed = {
    title:       `📊 Fan Comparison — ${PERIOD_LABEL[period]}`,
    description,
    color:       0x5865F2,
    fields,
    footer:      { text: footerText },
    timestamp:   new Date().toISOString(),
  };

  return { success: true, embed };
}

// ──────────────────────────────────────────────────────────────────────────────
// Leaderboard Query Detection & Lookup
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Detect if a query is asking about the leaderboard, top trainers, or rankings.
 * Used by messageCreate.js to bypass the AI pipeline.
 */
export function isLeaderboardQuery(query) {
  const lower = query.toLowerCase().replace(/[?!.]+$/, '').trim();

  // Don't match comparison queries (handled separately)
  if (isComparisonQuery(query) || isMultiComparison(query)) return false;

  const hasSelfRef = /\b(i|my|me|mine|myself|i'm|im)\b/i.test(lower);

  // Leaderboard-specific keywords (no trailing \b on alternation groups to allow suffixes)
  const isLeaderboardRelated = /\b(leaderboard|leader\s*board|top\s+(trainers?|\d+|ranked|fan)|rankings?|rank\s+(list|\d+|check)|number\s+(one|1)|#1|first\s+place|first\b|highest\s+(rank|ranked)|at\s+the\s+top|on\s+top|winning|leading|best\s+trainer|most\s+fans|least\s+fans|biggest\s+gainer|climbing|dropped|last\s+place|at\s+the\s+bottom|lowest\s+ranked|falling\s+behind|catching\s+up|gained\s+the\s+most|whos?\s+(number|#|first|winning|on\s+top|the\s+best|in\s+first|boss)|who\s+(da|the)\s+best)\b/i.test(lower);

  // Self-ref + position words → leaderboard position query
  // "where do i rank" / "where am i on the leaderboard" → leaderboard
  // "what position am i" / "what rank am i" → personal stats (NOT leaderboard)
  const isPositionQuery = hasSelfRef && /\b(where\s+(do|am|is|does)\s+(i|my)\s+(rank|stand|place|sit)|where\s+(is|are)\s+my\s+(rank|position)|am\s+i\s+on\s+the\s+leaderboard|what\s+place\s+am\s+i\s+in\b|where\s+(do\s+)?i\s+fall)\b/i.test(lower);

  // Self-ref as object ("show me", "tell me", "gimme") is NOT self-reference
  const isObjectPronoun = /\b(show|tell|give|let|gimme|lemme|pull)\s+me\b/i.test(lower);

  if (!isLeaderboardRelated && !isPositionQuery) return false;

  // Question/request detection
  const hasQuestionWord = /\b(show|display|pull|list|give|tell|who|what|where|how|can|could|check|see|want|lemme|gimme|lets|yo|ayo|sup|hey|please|whats|whos|wheres?)\b/i.test(lower)
    || lower.includes('?');

  // Statement-like: just says "leaderboard", "rankings", "top 10", "rank check", etc.
  const isStatementRequest = /\b(leaderboard|rankings?|top\s+\d+|top\s+trainers?|current\s+(leaderboard|rankings?)|circle\s+rankings?|fan\s+rankings?|rank\s+check|lowest\s+ranked|biggest\s+gainer)\b/i.test(lower)
    && !/\b(meaning|means?|define|what\s+is\s+(a|the))\b/i.test(lower);

  const isQuestionLike = hasQuestionWord || isStatementRequest || isPositionQuery;
  if (!isQuestionLike) return false;

  // "me" as indirect object is not self-reference ("show me the leaderboard")
  const effectiveSelfRef = hasSelfRef && !isObjectPronoun;

  // Self-ref position queries always route to leaderboard
  if (isPositionQuery) return true;

  // No self-ref + leaderboard keywords → general leaderboard query
  if (!effectiveSelfRef && (isLeaderboardRelated || isStatementRequest)) return true;

  return false;
}

/**
 * Look up the leaderboard — returns a ranked list of all linked trainers in the guild.
 *
 * @param {string} guildId
 * @returns {Promise<{ success: boolean, content: string }>}
 */
export async function getLeaderboard(guildId) {
  const { links } = await listLinks(guildId, { limit: 50 });
  if (!links || links.length === 0) {
    return {
      success: false,
      content: 'no one is linked in this server yet... 😢 an admin needs to use `/link [trainer_id]` for each member first~! once linked i can show the full leaderboard! 💕',
    };
  }

  // Resolve all trainers
  const resolved = [];
  const notLinked = [];
  const noData = [];

  const results = await Promise.allSettled(
    links.map(async (link) => {
      const data = await resolveTrainerData(link.discordId, guildId);
      return { link, data };
    })
  );

  for (const r of results) {
    if (r.status === 'rejected') continue;
    const { link, data } = r.value;
    if (!data) {
      notLinked.push({ displayName: link.trainerName || link.discordId });
    } else if (data.noData) {
      noData.push({ displayName: link.trainerName || link.discordId, name: data.trainerName });
    } else {
      resolved.push({
        trainerName: data.trainerName,
        displayName: link.trainerName || link.discordId,
        lifetime: data.lifetime ?? 0,
        daily: data.daily ?? 0,
        weekly: data.weekly ?? 0,
        monthly: data.monthly ?? 0,
        rank: data.rank ?? null,
        storedAt: data.storedAt,
      });
    }
  }

  // Sort by lifetime fans descending
  resolved.sort((a, b) => b.lifetime - a.lifetime);

  // Build reply
  const lines = [];
  lines.push('🏆 **Circle Leaderboard** 🏆');
  lines.push('');

  if (resolved.length === 0) {
    lines.push('everyone is linked but no one has fan data yet... 😢 try `/fan_gain` first~! 💕');
  } else {
    const medals = ['🥇', '🥈', '🥉'];
    const topFans = resolved[0].lifetime;
    const useCompact = resolved.length > 12;

    for (let i = 0; i < Math.min(resolved.length, 25); i++) {
      const r = resolved[i];
      const pos = i + 1;
      const posLabel = medals[i] ?? `${pos}.`.padStart(3, ' ');
      const name = r.displayName || r.trainerName;

      let fanStr;
      if (useCompact && r.lifetime >= 1_000_000_000) {
        fanStr = `${(r.lifetime / 1_000_000_000).toFixed(1)}B`;
      } else if (useCompact && r.lifetime >= 1_000_000) {
        fanStr = `${(r.lifetime / 1_000_000).toFixed(1)}M`;
      } else if (useCompact && r.lifetime >= 1_000) {
        fanStr = `${(r.lifetime / 1_000).toFixed(1)}K`;
      } else {
        fanStr = r.lifetime.toLocaleString('en-US');
      }

      // Daily gain indicator
      let dailyTag = '';
      if (r.daily >= 1_000_000) dailyTag = ' 🔥';
      else if (r.daily >= 500_000) dailyTag = ' 📈';

      // Gap from #1
      let gapStr = '';
      if (i > 0 && topFans > 0) {
        const diff = topFans - r.lifetime;
        if (diff > 1_000_000) {
          gapStr = `  _(${(diff / 1_000_000).toFixed(1)}M behind)_`;
        } else if (diff > 1_000) {
          gapStr = `  _(${(diff / 1_000).toFixed(1)}K behind)_`;
        }
      }

      lines.push(`${posLabel} **${name}**: ${fanStr}${dailyTag}${gapStr}`);
    }

    if (resolved.length > 25) {
      lines.push('');
      lines.push(`...and ${resolved.length - 25} more trainers~! use "/leaderboard" for the full list! 💕`);
    }
  }

  // Warnings — show even when leaderboard has results
  if (notLinked.length > 0 || noData.length > 0) {
    lines.push('');
    const parts = [];
    if (notLinked.length > 0) parts.push(`🔗 ${notLinked.length} unresolved: ${notLinked.map(n => n.displayName).join(', ')}`);
    if (noData.length > 0) parts.push(`📭 ${noData.length} no data: ${noData.map(n => n.displayName || n.name).join(', ')}`);
    lines.push(`⚠️ ${parts.join(' · ')}`);
  }

  // Freshness
  let maxAge = 0;
  if (resolved.length > 0) {
    maxAge = Math.max(...resolved.map(r => {
      if (!r.storedAt) return 0;
      return Math.round((Date.now() - new Date(r.storedAt).getTime()) / 60000);
    }));
  }
  if (maxAge > 60) {
    lines.push('');
    lines.push(`📌 _oldest data ${maxAge}m ago — run "/fan_gain" to refresh~_`);
  }

  // Discord 2000-char limit
  let content = lines.join('\n');
  if (content.length > 1950) {
    const cutoff = content.lastIndexOf('\n', 1900);
    content = content.slice(0, cutoff > 0 ? cutoff : 1900);
    content += '\n\n📌 _...truncated — use "/leaderboard" for the full list~_ 😅';
  }

  return { success: true, content };
}
