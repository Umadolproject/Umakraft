// Distribution/Coordinator/actions/clubGain.js
import { processClubGain } from '../../../umamoe/pipeline.js';
import { produce, claimDeliverable } from '../../../Workshop/pipeline.js';
import { parseCircleId } from '../utils/parseCircle.js';
import { CONFIGURED_CIRCLES } from '../../../core/botConfig.js';

const PUPPETEER_DISABLED = process.env.PUPPETEER_DISABLED === 'true';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtGain(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toLocaleString('en-US');
}

/**
 * Club Gain embed matching blueprint:
 *   Club name + Period → Daily gain table → Summary (total/avg/high/low)
 */
function buildClubGainEmbed(clubId, clubName, days, rows, summary, interaction) {
  const fields = [];

  // Daily gain table (compact)
  if (Array.isArray(rows) && rows.length > 0) {
    const tableLines = rows.slice(0, 30).map(r => {
      const date = r.date ?? r.day ?? '—';
      const gain = fmtGain(r.gain ?? r.dailyGain ?? 0);
      const running = (r.runningTotal ?? r.cumulative ?? 0).toLocaleString('en-US');
      return `\`${String(date).padEnd(8)}\` ${String(gain).padEnd(14)} ${running}`;
    });
    if (rows.length > 30) tableLines.push(`... and ${rows.length - 30} more days`);
    fields.push({ name: '📅 Daily Breakdown', value: '```' + tableLines.join('\n') + '```', inline: false });
  }

  // Summary stats
  if (summary && typeof summary === 'object') {
    const sLines = [];
    if (summary.totalGain != null)   sLines.push(`**Total Gain:** ${summary.totalGain.toLocaleString('en-US')}`);
    if (summary.averageDay != null)  sLines.push(`**Average/Day:** ${summary.averageDay.toLocaleString('en-US')}`);
    if (summary.highestDay != null)  sLines.push(`**Highest Day:** ${summary.highestDay.toLocaleString('en-US')}`);
    if (summary.lowestDay != null)   sLines.push(`**Lowest Day:** ${summary.lowestDay.toLocaleString('en-US')}`);
    if (sLines.length > 0) fields.push({ name: '📊 Summary', value: sLines.join('\n'), inline: false });
  }

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    interaction,
    result: {
      title:       `📈 Club Gain — ${clubName ?? `Circle ${clubId}`}`,
      description: `**Period:** Last ${days} days`,
      fields,
      footer:      { text: 'clubGain · UmaKraft · uma.moe data' },
      timestamp:   new Date().toISOString(),
    },
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function clubGain(payload) {
  const { interaction, options, guildId } = payload;

  const circleId = parseCircleId(options.club) ?? CONFIGURED_CIRCLES[0] ?? null;
  const days = options.days ?? 30;

  const result = await processClubGain({ circleId, days, guildId });
  if (!result.success) {
    return {
      success:   false,
      failedAt:  result.failedAt ?? 'Umamoe',
      error:     result.error ?? 'CLUB_GAIN_FAILED',
      message:   result.message ?? 'Club gain pipeline failed',
      retriable: result.retriable ?? false,
      interaction,
    };
  }

  const { clubId: cId, clubName, rows, summary } = result.clubGain;

  // Text mode — skip Puppeteer for low-RAM environments (Railway)
  if (PUPPETEER_DISABLED) {
    return buildClubGainEmbed(cId, clubName, days, rows, summary, interaction);
  }

  const fabricatorInput = {
    blueprintKey: 'clubGain',
    meta: {
      clubId: cId,
      clubName,
      periodDays: days,
      generatedAt: new Date().toISOString(),
    },
    rows,
    summary,
  };

  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    console.warn(`[clubGain] Fabricator failed — falling back to text embed. Error: ${produced.message}`);
    return buildClubGainEmbed(cId, clubName, days, rows, summary, interaction);
  }

  const claimed = await claimDeliverable(produced.terminalId);
  if (!claimed.success) {
    console.warn(`[clubGain] Terminal claim failed — falling back to text embed. Error: ${claimed.message}`);
    return buildClubGainEmbed(cId, clubName, days, rows, summary, interaction);
  }

  return {
    success:      true,
    terminalId:   produced.terminalId,
    blueprintKey: 'clubGain',
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}
