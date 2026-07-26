// Distribution/Coordinator/actions/leaderboard.js
import { fetchLeaderboardEntries } from '../../../umamoe/rankingsQuick.js';
import { parseCircleId } from '../utils/parseCircle.js';

// ── Cooldown: 30 seconds per user (in-memory, resets on deploy) ──────────────
const cooldowns = new Map();
const COOLDOWN_MS = 30_000;

// ── Embed builder (mirrors buildRankingsEmbed in pipelineImage.js) ─────────────

function buildEmbed({ topEntries, scope, gainField, total, circle, date, interaction }) {
  const scopeLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[scope] ?? scope;
  const dateLabel = date ? ` \u00b7 ${date}` : '';
  const circleLabel = circle ? `Circle ${circle}` : 'All Circles';
  const medal = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

  const description = topEntries.length === 0
    ? 'No data available for this period.'
    : topEntries.map((e, i) => {
        const pos = i + 1;
        const posLabel = medal[i] ?? `#${pos}`;
        const gain = e[gainField];
        const gainStr = gain == null
          ? '\u2014'
          : (gain >= 0 ? '+' : '\u2212') + Math.abs(gain).toLocaleString('en-US');
        return `${posLabel} **${e.name ?? e.id ?? '\u2014'}** \u2014 ${gainStr} ${scopeLabel.toLowerCase()}`;
      }).join('\n');

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `\uD83C\uDFC6 Fan Gain Leaderboard \u2014 ${circleLabel}${dateLabel}`,
      description,
      footer:      { text: `${scopeLabel} \u00b7 Top ${topEntries.length} of ${total} trainers \u00b7 UmaKraft` },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function leaderboard(payload) {
  const { options, interaction } = payload;
  const userId = interaction?.user?.id ?? 'unknown';

  // ── Cooldown check ──────────────────────────────────────────────────────────
  const now = Date.now();
  const lastUsed = cooldowns.get(userId);
  if (lastUsed && (now - lastUsed) < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1000);
    return {
      success:   true,
      type:      'embed',
      ephemeral: true,
      result: {
        title:       '\u23F3 Cooldown',
        description: `Please wait **${remaining}s** before using \`/leaderboard\` again.`,
        footer:      { text: 'Cooldown: 30 seconds per user' },
      },
      interaction,
    };
  }

  const circle = parseCircleId(options.circle) ?? null;
  const scope  = options.scope  ?? 'daily';
  const top    = options.top    ?? 10;
  const date   = options.date   ?? null;

  // ── Fetch entries via the direct fast-path ──────────────────────────────────
  const result = await fetchLeaderboardEntries({ scope, top, circle, date });

  if (!result.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     result.error ?? 'PIPELINE_STAGE_ERROR',
      message:   result.message ?? 'Could not retrieve leaderboard data.',
      retriable: true,
      interaction,
    };
  }

  // ── Record cooldown (only on success — failed attempts are free) ────────────
  cooldowns.set(userId, now);
  // Prune stale cooldowns every 100 calls to avoid memory leak
  if (cooldowns.size > 100) {
    for (const [id, ts] of cooldowns) {
      if (now - ts > COOLDOWN_MS) cooldowns.delete(id);
    }
  }

  // ── Build and return embed ─────────────────────────────────────────────────
  return buildEmbed({
    topEntries: result.entries,
    scope,
    gainField:  result.gainField,
    total:      result.total,
    circle,
    date,
    interaction,
  });
}
