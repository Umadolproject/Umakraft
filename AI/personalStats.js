// AI/personalStats.js
// Live fan-data lookup for #bot-chat @mention queries like "how many fans do I have?"
//
// Flow: Discord user → getLinkByDiscordId → trainerId → retrieve Depot product → text reply
//
// Reuses the same data layer the /fan_gain slash command uses, but returns
// a personality-rich text summary instead of an image card.

import { getLinkByDiscordId, listLinks } from '../Distribution/Coordinator/utils/memberLinks.js';
import { retrieve }            from '../Refinery/Depot/depot.js';
import { createLogger }        from '../core/pipelineLogger.js';

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

// ─── Single trainer lookup ───────────────────────────────────────────────────

/**
 * Resolve a Discord user to their trainer data from the Depot.
 * Returns { trainerName, trainerId, lifetime, daily, weekly, monthly, rank, storedAt } or null.
 */
async function resolveTrainerData(discordId, guildId) {
  const link = await getLinkByDiscordId(discordId, guildId);
  if (!link) return null;

  const { product } = await retrieve(link.trainerId);
  if (!product?.compiledProduct) {
    return {
      trainerName: link.trainerName,
      trainerId: link.trainerId,
      noData: true,
    };
  }

  const cp   = product.compiledProduct;
  const meta = cp.meta ?? {};
  const fans = cp.fans ?? {};

  return {
    trainerName: meta.trainerName ?? link.trainerName ?? link.trainerId,
    trainerId:   link.trainerId,
    lifetime:    fans.lifetime,
    daily:       fans.daily,
    weekly:      fans.weekly,
    monthly:     fans.monthly,
    rank:        cp.rank,
    storedAt:    product.storedAt,
  };
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
      content: "hmm... i don't know which trainer you are yet! 😣 use `/link [your_trainer_id]` to connect your Discord to your uma.moe account, and then i can tell you all about your fans~! 💕",
    };
  }

  if (data.noData) {
    logger.warn(`No depot product for trainer ${data.trainerId} (${data.trainerName})`);
    return {
      success: false,
      linkRequired: false,
      content: `i found your trainer **${data.trainerName}** but i don't have any recent fan data yet... 😢 try using \`/fan_gain\` first to generate your stats card, then i can answer this next time~! 💕`,
    };
  }

  // Build personality-rich reply
  const lines = [];
  lines.push(`here's your stats, ${data.trainerName}~! 🏇✨`);
  lines.push('');

  if (data.lifetime != null) {
    lines.push(`🏆 **Total Fans**: ${fmt(data.lifetime)}`);
  }
  if (data.daily != null) {
    const emoji = data.daily >= 1_000_000 ? '🔥' : data.daily >= 500_000 ? '💪' : data.daily >= 100_000 ? '📈' : '😅';
    lines.push(`📊 **Today's Gain**: ${fmtDiff(data.daily)} ${emoji}`);
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
    lines.push(`📊 **Circle Rank**: #${data.rank}`);
  }

  // Daily goal check
  if (data.daily != null && data.daily < 1_000_000) {
    const remaining = (1_000_000 - data.daily).toLocaleString('en-US');
    lines.push('');
    lines.push(`💡 You need **${remaining} more fans** today to hit the 1M goal~! Ganbatte! 💕`);
  }

  // Freshness note
  if (data.storedAt) {
    const age = Math.round((Date.now() - new Date(data.storedAt).getTime()) / 60000);
    if (age > 60) {
      lines.push('');
      lines.push(`📌 _last synced ${age}m ago — run \`/fan_gain\` for the latest~_`);
    }
  }

  return { success: true, content: lines.join('\n') };
}

// ─── Fan comparison ──────────────────────────────────────────────────────────

/**
 * Compare fan counts between two trainers.
 *
 * @param {string}   discordIdA — Discord ID of first trainer (or the asker)
 * @param {string}   guildId
 * @param {string}   query      — original query (for extracting subjects)
 * @param {Map|Collection} mentions — Discord message.mentions.users Collection
 * @returns {Promise<{ success: boolean, content: string }>}
 */
export async function compareStats(discordIdA, guildId, query, mentions) {
  // ── Determine who the two subjects are ──────────────────────────────────
  const lower = query.toLowerCase();
  const mentionedUsers = mentions ? [...mentions.values()] : [];

  let subjectA = null; // { discordId, label, tag }
  let subjectB = null;

  // Case 1: "me/my/i" + @mention → asker vs mentioned
  const hasSelfRef = /\b(me|my|mine|i)\b/i.test(lower);
  const hasOneMention = mentionedUsers.length === 1 && hasSelfRef;

  if (hasOneMention) {
    const mentioned = mentionedUsers[0];
    subjectA = { discordId: discordIdA, label: 'You', tag: null };
    subjectB = { discordId: mentioned.id, label: null, tag: mentioned.username };
  }

  // Case 2: two @mentions → mentioned1 vs mentioned2
  else if (mentionedUsers.length >= 2) {
    const first  = mentionedUsers[0];
    const second = mentionedUsers[1];
    subjectA = { discordId: first.id,  label: null, tag: first.username };
    subjectB = { discordId: second.id, label: null, tag: second.username };
  }

  // Case 3: one @mention without self-ref → mentioned vs asker (implied)
  else if (mentionedUsers.length === 1) {
    const mentioned = mentionedUsers[0];
    subjectA = { discordId: discordIdA, label: 'You', tag: null };
    subjectB = { discordId: mentioned.id, label: null, tag: mentioned.username };
  }

  // Case 4: only self-ref, no mentions → fallback to personal stats
  else {
    return getStats(discordIdA, guildId);
  }

  // Prevent comparing self with self
  if (subjectA.discordId === subjectB.discordId) {
    return {
      success: false,
      content: "ehe~ that's... just you! 😂 want to compare with someone else? mention them and i'll do it~! 💕",
    };
  }

  // ── Resolve both trainers ───────────────────────────────────────────────
  const [dataA, dataB] = await Promise.all([
    resolveTrainerData(subjectA.discordId, guildId),
    resolveTrainerData(subjectB.discordId, guildId),
  ]);

  const displayA = subjectA.label ?? `@${subjectA.tag}`;
  const displayB = subjectB.label ?? `@${subjectB.tag}`;

  // Error cases
  if (!dataA) {
    return {
      success: false,
      content: `hmm... ${displayA} doesn't seem to be linked to a trainer yet! 😣 they need to use \`/link\` first~`,
    };
  }
  if (!dataB) {
    return {
      success: false,
      content: `hmm... ${displayB} doesn't seem to be linked to a trainer yet! 😣 they need to use \`/link\` first~`,
    };
  }
  if (dataA.noData && dataB.noData) {
    return {
      success: false,
      content: `neither ${displayA} nor ${displayB} have any recent fan data... 😢 both of you try running \`/fan_gain\` first~! 💕`,
    };
  }
  if (dataA.noData) {
    return {
      success: false,
      content: `${displayA} (${dataA.trainerName}) doesn't have recent fan data yet... 😢 try running \`/fan_gain\` first~!`,
    };
  }
  if (dataB.noData) {
    return {
      success: false,
      content: `${displayB} (${dataB.trainerName}) doesn't have recent fan data yet... 😢 try running \`/fan_gain\` first~!`,
    };
  }

  // ── Build comparison reply ──────────────────────────────────────────────
  const lines = [];
  lines.push('📊 **Fan Comparison~!**');
  lines.push('');

  const nameA = `${displayA} (${dataA.trainerName})`;
  const nameB = `${displayB} (${dataB.trainerName})`;

  // Lifetime fans
  if (dataA.lifetime != null && dataB.lifetime != null) {
    const diff = dataA.lifetime - dataB.lifetime;
    lines.push(`🏇 **${nameA}**: ${fmt(dataA.lifetime)}`);
    lines.push(`🏇 **${nameB}**: ${fmt(dataB.lifetime)}`);
    lines.push('');

    if (diff !== 0) {
      const leader = diff > 0 ? displayA : displayB;
      const gap     = Math.abs(diff).toLocaleString('en-US');
      const emoji   = Math.abs(diff) > 100_000_000 ? '😱' : Math.abs(diff) > 10_000_000 ? '📈' : '🤏';
      lines.push(`📏 **Difference**: ${fmtDiff(diff)} fans`);
      lines.push(`👑 **${leader}** is ahead by **${gap}**! ${emoji}`);
    } else {
      lines.push(`✨ It's a tie! Both have ${fmt(dataA.lifetime)} fans~!`);
    }
  } else {
    lines.push(`🏇 **${nameA}**: ${dataA.lifetime != null ? fmt(dataA.lifetime) : '—'}`);
    lines.push(`🏇 **${nameB}**: ${dataB.lifetime != null ? fmt(dataB.lifetime) : '—'}`);
    lines.push('');
    lines.push('📏 Not enough data to compare yet~ 😅');
  }

  // Today's gains (bonus)
  if (dataA.daily != null && dataB.daily != null) {
    const dayDiff = dataA.daily - dataB.daily;
    const dayLeader = dayDiff > 0 ? displayA : dayDiff < 0 ? displayB : null;
    if (dayLeader) {
      lines.push('');
      lines.push(`📊 **Today**: ${dayLeader} is ahead by **${Math.abs(dayDiff).toLocaleString('en-US')}** fans~! 🔥`);
    } else {
      lines.push('');
      lines.push(`📊 **Today**: both tied at ${fmtDiff(dataA.daily)}~! 🤝`);
    }
  }

  // Ranks
  if (dataA.rank != null && dataB.rank != null) {
    lines.push('');
    lines.push(`📊 **Rank**: ${displayA} #${dataA.rank} · ${displayB} #${dataB.rank}`);
  }

  // Freshness note
  const ages = [];
  if (dataA.storedAt) {
    const age = Math.round((Date.now() - new Date(dataA.storedAt).getTime()) / 60000);
    if (age > 60) ages.push(`${displayA}: ${age}m ago`);
  }
  if (dataB.storedAt) {
    const age = Math.round((Date.now() - new Date(dataB.storedAt).getTime()) / 60000);
    if (age > 60) ages.push(`${displayB}: ${age}m ago`);
  }
  if (ages.length > 0) {
    lines.push('');
    lines.push(`📌 _${ages.join(' · ')} — run \`/fan_gain\` for fresher data~_`);
  }

  return { success: true, content: lines.join('\n') };
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

  // Don't match if it looks like a comparison of any kind
  if (isComparisonQuery(query) || isMultiComparison(query)) return false;

  const patterns = [
    /^(how\s+)?(many|much)\s+(fans?|fan\s*(count|gain|points?))\s+(do\s+)?i\s+have/i,
    /^(my|what('?s| is| are)?\s+my)\s+(fans?|fan\s*(count|gain|stats?|points?|rank))/i,
    /^(check|show|tell|give)\s+(me\s+)?(my|the)\s+(fans?|fan\s*(count|gain|stats?|points?|rank))/i,
    /^(how|what)\s+(am\s+)?i\s+(doing|rank(ed|ing)?)/i,
    /^(what|how)\s+(is|are)\s+my\s+(stats?|progress)/i,
    /^(fan|stats?|rank)\s+(check|status|update|info)/i,
    /^my\s+(daily|weekly|monthly)\s+(fan\s*)?(gain|count|fans)/i,
    /^(lifetime|total)\s+fans?$/i,
    /^(how\s+)?(am\s+)?i\s+(doing|performing)/i,
  ];

  return patterns.some(p => p.test(lower));
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
  const hasCompareKeyword = /\b(difference|compar(ed?|ison)|vs\.?|versus|more fans|ahead|behind|gap|closer to)\b/i.test(lower);

  if (!hasMention && !hasCompareKeyword) return false;

  const patterns = [
    /difference\s+(between|of)\s+(me|my|@|.+?)\s+and\b/i,
    /compare\s+(my|@|.+?)\s+(fans?\s+)?(with|and|to|vs)/i,
    /who\s+(has|got|have)\s+(more|less|the most)\s+fans/i,
    /how\s+much\s+(more|less)\s+fans\s+(does|do|has)/i,
    /@.+?\s+(vs\.?|versus)\s+@/i,
    /how\s+(far|close|much)\s+(am\s+)?i\s+(from|to|behind|ahead\s+of)\s+@/i,
    /(am\s+i|is\s+@)\s+(ahead|behind|winning|losing|leading)/i,
    /(gap|difference)\s+between\s+@.+?\s+and\s+@/i,
    /@.+?\s+or\s+@.+?\s+(more|less|fans)/i,
  ];

  return patterns.some(p => p.test(lower));
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

  const mentionMatches = query.match(/<@!?\d+>/g) || [];
  const distinctIds = new Set(mentionMatches.map(m => m.replace(/[<@!>]/g, '')));
  const hasSelf = /\b(me|my|mine)\b/i.test(lower) || /\bi\s+(have|got|am|want|need)\b/i.test(lower);
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
  const hasFanKeyword = /\b(fans?|fan\s*(count|gain)|stats?|rank(ing|ed)?|compare|compar|vs\.?|versus|difference|leaderboard|who\s+has|top|most|among|listing|list|show)\b/i.test(lower);

  // @everyone / @here MUST have fan context to avoid false positives
  if (isEveryone) return hasFanKeyword;

  // 3+ regular mentions: always a comparison in #bot-chat context
  return hasFanKeyword || subjectCount >= 3;
}

/**
 * Compare fan counts across 3–30 trainers with a ranked leaderboard.
 */
export async function compareMulti(discordId, guildId, query, mentions) {
  const MAX_TRAINERS = 30;
  const lower = query.toLowerCase();
  const mentionedUsers = mentions ? [...mentions.values()] : [];

  // ── Collect subjects (deduplicated) ─────────────────────────────────────
  const subjects = [];
  const seen = new Set();

  const isEveryone = /@everyone|@here/i.test(query);

  // @everyone / @here → fetch ALL linked members from the guild
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

  // ── Resolve all in parallel ─────────────────────────────────────────────
  const results = await Promise.all(capped.map(async (s) => {
    const data = await resolveTrainerData(s.discordId, guildId);
    return { subject: s, data };
  }));

  const ranked    = [];
  const noData    = [];
  const notLinked = [];

  for (const r of results) {
    if (!r.data)          notLinked.push(r.subject);
    else if (r.data.noData) noData.push({ displayName: r.subject.displayName, name: r.data.trainerName });
    else                   ranked.push({ displayName: r.subject.displayName, ...r.data });
  }

  ranked.sort((a, b) => (b.lifetime ?? 0) - (a.lifetime ?? 0));

  // ── Build reply ─────────────────────────────────────────────────────────
  const lines = [];
  const total = capped.length;
  const header = isEveryone
    ? `📊 **Circle Fan Comparison — ${ranked.length} of ${total} linked trainers~!**`
    : `📊 **Fan Comparison — ${ranked.length} of ${total} trainers~!**`;
  lines.push(header);
  lines.push('');

  if (ranked.length === 0) {
    if (notLinked.length > 0) {
      lines.push(`no one is linked... 😢 ${notLinked.map(s => s.displayName).join(', ')} need \`/link\`~!`);
    } else {
      lines.push('no fan data yet... 😢 everyone try `/fan_gain` first~! 💕');
    }
  } else {
    const medals  = ['🥇', '🥈', '🥉'];
    const topFans = ranked[0].lifetime ?? 0;
    const useCompact = ranked.length > 12;

    for (let i = 0; i < ranked.length; i++) {
      const r  = ranked[i];
      const pos = i + 1;
      const posLabel = medals[i] ?? `${pos}.`.padStart(3, ' ');
      const name = `${r.displayName} (${r.trainerName})`;

      let fanStr;
      if (useCompact && r.lifetime >= 1_000_000_000) {
        fanStr = `${(r.lifetime / 1_000_000_000).toFixed(1)}B`;
      } else if (useCompact && r.lifetime >= 1_000_000) {
        fanStr = `${(r.lifetime / 1_000_000).toFixed(1)}M`;
      } else if (useCompact && r.lifetime >= 1_000) {
        fanStr = `${(r.lifetime / 1_000).toFixed(1)}K`;
      } else {
        fanStr = fmt(r.lifetime);
      }

      let gapStr = '';
      if (i > 0 && topFans > 0 && r.lifetime != null) {
        const gap = r.lifetime - topFans;
        if (gap !== 0) {
          if (useCompact && Math.abs(gap) >= 1_000_000) {
            gapStr = `  (−${(Math.abs(gap) / 1_000_000).toFixed(1)}M)`;
          } else if (useCompact && Math.abs(gap) >= 1_000) {
            gapStr = `  (−${(Math.abs(gap) / 1_000).toFixed(1)}K)`;
          } else {
            gapStr = `  (${fmtDiff(gap)})`;
          }
        }
      }

      lines.push(`${posLabel} ${name}: ${fanStr}${gapStr}`);
    }
  }

  // ── Warnings ────────────────────────────────────────────────────────────
  if (notLinked.length > 0 || noData.length > 0) {
    lines.push('');
    const parts = [];
    if (notLinked.length > 0) {
      parts.push(`🔗 ${notLinked.length} not linked: ${notLinked.map(s => s.displayName).join(', ')}`);
    }
    if (noData.length > 0) {
      parts.push(`📭 ${noData.length} no data: ${noData.map(n => `${n.displayName} (${n.name})`).join(', ')}`);
    }
    lines.push(`⚠️ ${parts.join(' · ')}`);
  }

  // ── Freshness ───────────────────────────────────────────────────────────
  const maxAge = Math.max(...ranked.map(r => {
    if (!r.storedAt) return 0;
    return Math.round((Date.now() - new Date(r.storedAt).getTime()) / 60000);
  }));
  if (maxAge > 60) {
    lines.push('');
    lines.push(`📌 _oldest data ${maxAge}m ago — run \`/fan_gain\` for fresher stats~_`);
  }

  // ── Discord 2000-char safety ────────────────────────────────────────────
  let content = lines.join('\n');
  if (content.length > 1950) {
    const cutoff = content.lastIndexOf('\n', 1900);
    content = content.slice(0, cutoff > 0 ? cutoff : 1900);
    content += '\n\n📌 _...truncated for Discord~_\n\n💡 _try comparing fewer trainers next time!_ 😅';
  }

  return { success: true, content };
}
