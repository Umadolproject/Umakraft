// Distribution/Coordinator/actions/leaderboard.js
//
// Dynamic import with fallback: tries fast-path (rankingsQuick) first.
// Falls back to runRankingsPipeline on any error.
import { parseCircleId } from '../utils/parseCircle.js';

// ── Cooldown: 30 seconds per user (in-memory, resets on deploy) ──────────────
const cooldowns = new Map();
const COOLDOWN_MS = 30_000;

// ── Embed builder ─────────────────────────────────────────────────────────────

function buildEmbed({ topEntries, scope, gainField, total, circleName, date, interaction }) {
  const scopeLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[scope] ?? scope;
  const dateLabel = date ? ` \u00b7 ${date}` : '';
  const circleLabel = circleName ?? 'All Circles';
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

// ─── Fast-path: build leaderboard directly from circle members ───────────────

async function leaderboardFastPath({ circle, scope, top, date, interaction }) {
  const { fetchLeaderboardEntries } = await import('../../../umamoe/rankingsQuick.js');
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

  return buildEmbed({
    topEntries: result.entries,
    scope,
    gainField:  result.gainField,
    total:      result.total,
    circleName: result.circleName,
    date,
    interaction,
  });
}

// ─── Fallback: old runRankingsPipeline path ──────────────────────────────────

async function leaderboardFallback(payload) {
  const { runRankingsPipeline } = await import('../utils/pipelineImage.js');
  const { options } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      circle: parseCircleId(options.circle) ?? null,
      scope:  options.scope  ?? 'daily',
      top:    options.top    ?? 10,
      date:   options.date   ?? null,
    },
    blueprintKey: 'leaderboard',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'leaderboard',
      meta: {
        circle:      parseCircleId(opts.circle) ?? null,
        scope:       opts.scope  ?? 'daily',
        top:         opts.top    ?? 10,
        date:        opts.date   ?? null,
        generatedAt: new Date().toISOString(),
      },
      entries: cp.entries ?? [],
      trend:   cp.trend   ?? null,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
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

  // The user may pass an explicit circle, or we use the configured default.
  // parseCircleId returns null for empty/undefined, so we DON'T null-coalesce
  // here — fetchLeaderboardEntries will apply CONFIGURED_CIRCLES[0] as default.
  const explicitCircle = parseCircleId(options.circle);
  const scope = options.scope ?? 'daily';
  const top   = options.top   ?? 10;
  const date  = options.date  ?? null;

  // ── Try fast path; fall back to old pipeline ───────────────────────────────
  let result;
  try {
    result = await leaderboardFastPath({ circle: explicitCircle, scope, top, date, interaction });
  } catch (err) {
    console.warn(
      `[leaderboard] Fast path unavailable (${err.message}) — falling back to runRankingsPipeline.`
    );
    try {
      result = await leaderboardFallback(payload);
    } catch (fallbackErr) {
      return {
        success:   false,
        failedAt:  'Commands',
        error:     'UNEXPECTED_ERROR',
        message:   `Leaderboard failed: ${fallbackErr.message}`,
        retriable: false,
        interaction,
      };
    }
  }

  // ── Record cooldown ────────────────────────────────────────────────────────
  if (result.success !== false) {
    cooldowns.set(userId, now);
    if (cooldowns.size > 100) {
      for (const [id, ts] of cooldowns) {
        if (now - ts > COOLDOWN_MS) cooldowns.delete(id);
      }
    }
  }

  return result;
}
