// Distribution/Coordinator/utils/pipelineImage.js
// Shared orchestration flow for all image-producing commands.
//
// Flow: resolveMember → processTrainer → retrieve (Depot) → produce (Workshop) → claimDeliverable
//
// Usage:
//   import { runImagePipeline } from '../utils/pipelineImage.js';
//   export async function fanGain(payload) {
//     return runImagePipeline({ payload, blueprintKey: 'fanGain', mapToFabricator: ... });
//   }

import { processTrainer, processRankings } from '../../../umamoe/pipeline.js';
import { retrieve }         from '../../../Refinery/Depot/depot.js';
import { produce, claimDeliverable } from '../../../Workshop/pipeline.js';
import { resolveMember }    from './resolveMember.js';
import { parseCircleId }    from './parseCircle.js';

// ── Text mode — skip Puppeteer/Chromium on low-RAM environments ────────────
// Set PUPPETEER_DISABLED=true to return Discord embeds instead of PNG images.
// This avoids launching Chromium (300-500 MB RAM) — critical for Railway free tier.
// Applies to BOTH single-trainer commands (profile, fan_gain, total_fan, joindate)
// AND ranking commands (leaderboard, intercircleleaderboard, circle_master, etc.)
const PUPPETEER_DISABLED = process.env.PUPPETEER_DISABLED === 'true';

// ── Shared helpers ──────────────────────────────────────────────────────────

function fmtGain(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
}

// ── Rankings Embed builder ──────────────────────────────────────────────────

/**
 * Build a Discord embed envelope from leaderboard data.
 * Used as a Puppeteer-free fallback for Railway / low-RAM environments.
 */
function buildRankingsEmbed({ topEntries, scope, gainField, total, blueprintKey, rankingsParams, interaction }) {
  const scopeLabel = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[scope] ?? scope;
  const dateLabel = rankingsParams?.date ? ` · ${rankingsParams.date}` : '';
  const circleLabel = rankingsParams?.circle ? `Circle ${rankingsParams.circle}` : 'All Circles';

  const medal = ['🥇', '🥈', '🥉'];

  const description = topEntries.length === 0
    ? 'No data available for this period.'
    : topEntries.map((e, i) => {
        const pos = i + 1;
        const posLabel = medal[i] ?? `#${pos}`;
        const gain = e[gainField];
        const gainStr = gain == null ? '—' : (gain >= 0 ? '+' : '−') + Math.abs(gain).toLocaleString('en-US');
        return `${posLabel} **${e.name ?? e.id ?? '—'}** — ${gainStr} ${scopeLabel.toLowerCase()}`;
      }).join('\n');

  return {
    success:  true,
    type:     'embed',
    ephemeral: false,
    result: {
      title:       `🏆 Fan Gain Leaderboard — ${circleLabel}${dateLabel}`,
      description,
      footer:      { text: `${scopeLabel} · Top ${topEntries.length} of ${total} trainers · UmaKraft` },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

/**
 * Build a Discord embed envelope from single-trainer compiled product data.
 * Used as a Puppeteer-free fallback for profile, fan_gain, total_fan, joindate.
 */
function buildTrainerEmbed(fabricatorInput, blueprintKey, interaction) {
  const meta        = fabricatorInput.meta ?? {};
  const fans        = fabricatorInput.fans ?? {};
  const trainerName = meta.trainerName ?? meta.trainerId ?? 'Unknown';
  const rankStr     = fabricatorInput.rank != null ? ` · #${fabricatorInput.rank}` : '';

  const fields = [];

  if (fans.lifetime != null) fields.push({ name: 'Lifetime Fans', value: fans.lifetime.toLocaleString('en-US'), inline: true });
  if (fans.daily != null)    fields.push({ name: 'Daily Gain',  value: fmtGain(fans.daily),           inline: true });
  if (fans.weekly != null)   fields.push({ name: 'Weekly Gain', value: fmtGain(fans.weekly),          inline: true });
  if (fans.monthly != null)  fields.push({ name: 'Monthly Gain',value: fmtGain(fans.monthly),         inline: true });

  if (fabricatorInput.rank != null) fields.push({ name: 'Rank',  value: `#${fabricatorInput.rank}`, inline: true });
  if (fabricatorInput.trend)        fields.push({ name: 'Trend', value: fabricatorInput.trend,       inline: true });
  if (meta.circle)                  fields.push({ name: 'Circle',value: meta.circle,                 inline: true });

  const pr = fabricatorInput.personalRecords;
  if (pr && typeof pr === 'object' && Object.keys(pr).length > 0) {
    const prLines = Object.entries(pr).map(([k, v]) =>
      `**${k}**: ${typeof v === 'number' ? v.toLocaleString('en-US') : v}`
    );
    fields.push({ name: '🏅 Personal Records', value: prLines.join('\n'), inline: false });
  }

  const milestones = fabricatorInput.milestones;
  if (Array.isArray(milestones) && milestones.length > 0) {
    const mLines = milestones.slice(0, 5).map(m =>
      `• ${m.title ?? m.type ?? m.name ?? 'Milestone'} — ${m.crossedAt ?? m.date ?? ''}`
    );
    fields.push({ name: '🏆 Recent Milestones', value: mLines.join('\n') || '—', inline: false });
  }

  const history = fabricatorInput.monthlyHistory;
  if (Array.isArray(history) && history.length > 0) {
    const hLines = history.slice(0, 6).map(h => {
      const label = h.month ?? h.period ?? h.label ?? '';
      const gain  = h.gain ?? h.totalGain ?? h.monthlyFanGain ?? 0;
      return `• ${label}: ${fmtGain(gain)}`;
    });
    fields.push({ name: '📊 Monthly History', value: hLines.join('\n') || '—', inline: false });
  }

  const description = meta.trainerId ? `Trainer ID: \`${meta.trainerId}\`` : '';
  const timestamp   = meta.generatedAt ?? new Date().toISOString();

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `🏇 ${trainerName}${rankStr}`,
      description,
      fields:      fields.length > 0 ? fields : [{ name: 'Status', value: 'No data available.' }],
      footer:      { text: `${blueprintKey} · UmaKraft` },
      timestamp,
    },
    interaction,
  };
}

/**
 * runImagePipeline — full pipeline for a single-trainer image command.
 *
 * @param {object} opts
 * @param {object}   opts.payload        — validated command payload from Commands
 * @param {string}   opts.blueprintKey   — Workshop blueprint key (e.g. 'fanGain')
 * @param {Function} opts.mapToFabricator — (compiledProduct) => fabricator input shape
 * @returns {Promise<envelope>}
 */
export async function runImagePipeline({ payload, blueprintKey, mapToFabricator }) {
  const { interaction, options, guildId, userId } = payload;

  // ── 1. Resolve trainer ID ─────────────────────────────────────────────────
  const resolved = await resolveMember(options, guildId, userId);
  if (!resolved.success) {
    return {
      success:   false,
      failedAt:  'Commands',
      error:     'MEMBER_NOT_LINKED',
      message:   resolved.message,
      retriable: false,
      interaction,
    };
  }
  const trainerId = resolved.value;

  // ── 2. Umamoe + Refinery pipeline ─────────────────────────────────────────
  const pipelineResult = await processTrainer(trainerId, {
    circleId: parseCircleId(options.circle),
  });
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     pipelineResult.error ?? 'PIPELINE_STAGE_ERROR',
      message:   pipelineResult.message ?? 'Umamoe pipeline failed',
      retriable: pipelineResult.retriable ?? true,
      interaction,
    };
  }

  // ── 3. Retrieve compiled product from Depot ──────────────────────────────
  const { product: depotProduct } = await retrieve(trainerId);
  if (!depotProduct) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'DEPOT_NOT_FOUND',
      message:   `No compiled product in Depot for trainer ${trainerId}`,
      retriable: false,
      interaction,
    };
  }

  // ── 4. Map to Fabricator input shape ─────────────────────────────────────
  const fabricatorInput = mapToFabricator(depotProduct.compiledProduct, options);

  // ── 5. Render: Fabricator (Puppeteer → PNG) or text embed fallback ─────

  // Text mode — skip Puppeteer entirely for low-RAM environments (Railway).
  if (PUPPETEER_DISABLED) {
    return buildTrainerEmbed(fabricatorInput, blueprintKey, interaction);
  }

  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    // Fabricator failed — fall back to text embed instead of showing an error.
    console.warn(
      `[pipelineImage] Fabricator failed for ${blueprintKey} — ` +
      `falling back to text embed. Error: ${produced.message}`
    );
    return buildTrainerEmbed(fabricatorInput, blueprintKey, interaction);
  }

  // ── 6. Claim deliverable from Terminal ────────────────────────────────────
  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    return {
      success:   false,
      failedAt:  'Terminal',
      error:     claimed.error ?? 'TERMINAL_NOT_FOUND',
      message:   claimed.message ?? 'Terminal claim failed',
      retriable: false,
      interaction,
    };
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey,
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}

/**
 * runRankingsPipeline — full pipeline for ranking / circle-wide image commands.
 * Uses processRankings instead of processTrainer.
 *
 * @param {object} opts
 * @param {object}   opts.payload
 * @param {object}   opts.rankingsParams  — params passed to processRankings
 * @param {string}   opts.blueprintKey
 * @param {Function} opts.mapToFabricator — (compiledProduct) => fabricator input
 */
// Abort rankings after this many ms and return a friendly timeout error.
// Keeps well within Discord's 15-minute interaction window while giving
// users a clear signal instead of a silent hang.
const RANKINGS_PIPELINE_TIMEOUT_MS = 25_000;

export async function runRankingsPipeline({ payload, rankingsParams, blueprintKey, mapToFabricator }) {
  const { interaction } = payload;

  // ── 0. Top-level timeout guard ───────────────────────────────────────────
  let _timeoutHandle;
  const timeoutPromise = new Promise((_, reject) => {
    _timeoutHandle = setTimeout(
      () => reject(Object.assign(new Error('RANKINGS_TIMEOUT'), { isRankingsTimeout: true })),
      RANKINGS_PIPELINE_TIMEOUT_MS,
    );
  });

  try {
    return await Promise.race([
      _runRankingsPipeline({ payload, rankingsParams, blueprintKey, mapToFabricator, interaction }),
      timeoutPromise,
    ]);
  } catch (err) {
    if (err.isRankingsTimeout) {
      console.error(
        `[pipelineImage] runRankingsPipeline timed out after ${RANKINGS_PIPELINE_TIMEOUT_MS}ms ` +
        `(blueprintKey=${blueprintKey}, scope=${rankingsParams?.scope}, top=${rankingsParams?.top})`,
      );
      return {
        success:   false,
        failedAt:  'Rankings',
        error:     'RANKINGS_TIMEOUT',
        message:   `Leaderboard timed out after ${RANKINGS_PIPELINE_TIMEOUT_MS / 1000}s`,
        retriable: true,
        interaction,
      };
    }
    throw err;
  } finally {
    clearTimeout(_timeoutHandle);
  }
}

async function _runRankingsPipeline({ payload, rankingsParams, blueprintKey, mapToFabricator, interaction }) {
  // ── 1. Umamoe + Refinery rankings pipeline ───────────────────────────────
  // processRankings stores each trainer's compiled product individually in the
  // Depot (keyed by trainer ID). There is no single unified "ranking" product.
  const pipelineResult = await processRankings(rankingsParams);
  if (!pipelineResult.success) {
    return {
      success:   false,
      failedAt:  'Umamoe',
      error:     pipelineResult.error ?? 'PIPELINE_STAGE_ERROR',
      message:   pipelineResult.message ?? 'Rankings pipeline failed',
      retriable: pipelineResult.retriable ?? true,
      interaction,
    };
  }

  // ── 2. Assemble leaderboard entries from individual Depot records ─────────
  // pipelineResult.results is an array of { success, trainerId, version, error }.
  const trainerResults = pipelineResult.results ?? [];
  const successful = trainerResults.filter(r => r.success);

  if (successful.length === 0) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'RANKINGS_NO_DATA',
      message:   'No trainer data was successfully processed for the leaderboard',
      retriable: false,
      interaction,
    };
  }

  const entries = [];
  for (const r of successful) {
    const { product: depotProduct } = await retrieve(r.trainerId);
    if (depotProduct?.compiledProduct) {
      entries.push(depotProduct.compiledProduct);
    }
  }

  if (entries.length === 0) {
    return {
      success:   false,
      failedAt:  'Refinery',
      error:     'DEPOT_NOT_FOUND',
      message:   'No compiled trainer products found in Depot for the leaderboard',
      retriable: false,
      interaction,
    };
  }

  // ── 3. Sort entries by scope gain and slice to top-N ─────────────────────
  const scope     = rankingsParams.scope ?? 'daily';
  const gainField = scope === 'monthly' ? 'monthlyFanGain'
                  : scope === 'weekly'  ? 'weeklyFanGain'
                  : 'dailyFanGain';
  const top = rankingsParams.top ?? 10;

  entries.sort((a, b) => (b[gainField] ?? 0) - (a[gainField] ?? 0));
  const topEntries = entries.slice(0, top);

  // ── 4. Build assembled product for the Fabricator ─────────────────────────
  const assembledProduct = {
    entries:           topEntries,
    trend:             topEntries[0]?.trend ?? null,
    presentationHints: { scope, gainField, total: entries.length },
  };

  // ── 5. Render: Fabricator (Puppeteer → PNG) or text embed fallback ─────

  // Text mode — skip Puppeteer entirely for low-RAM environments (Railway).
  // Returns a native Discord embed with formatted leaderboard fields.
  if (PUPPETEER_DISABLED) {
    return buildRankingsEmbed({
      topEntries,
      scope,
      gainField,
      total: entries.length,
      blueprintKey,
      rankingsParams,
      interaction,
    });
  }

  // Full image mode — Fabricator → Chromium → PNG → Terminal
  const fabricatorInput = mapToFabricator(assembledProduct, payload.options ?? {});
  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    // Fabricator failed — fall back to text embed instead of showing an error.
    // Common on Railway where Chromium can't launch (OOM / missing deps).
    console.warn(
      `[pipelineImage] Fabricator failed for ${blueprintKey} — ` +
      `falling back to text embed. Error: ${produced.message}`
    );
    return buildRankingsEmbed({
      topEntries,
      scope,
      gainField,
      total: entries.length,
      blueprintKey,
      rankingsParams,
      interaction,
    });
  }

  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    return { success: false, failedAt: 'Terminal', error: claimed.error ?? 'TERMINAL_NOT_FOUND', message: claimed.message, retriable: false, interaction };
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey,
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}
