// Distribution/Coordinator/actions/fanGain.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtGain(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toLocaleString('en-US');
}

/**
 * Fan Gain embed matching blueprint:
 *   Avatar + Lifetime fans → Daily/Weekly/Monthly gains → Rank
 */
function buildFanGainEmbed(fabricatorInput, blueprintKey, interaction) {
  const meta = fabricatorInput.meta ?? {};
  const fans = fabricatorInput.fans ?? {};
  const trainerName = meta.trainerName ?? meta.trainerId ?? 'Unknown';

  const thumbnailUrl = interaction.user?.displayAvatarURL({ dynamic: true, size: 256 }) ?? null;

  const fields = [];
  if (fans.daily != null)   fields.push({ name: '📈 Daily',    value: fmtGain(fans.daily),   inline: true });
  if (fans.weekly != null)  fields.push({ name: '📈 Weekly',   value: fmtGain(fans.weekly),  inline: true });
  if (fans.monthly != null) fields.push({ name: '📈 Monthly',  value: fmtGain(fans.monthly), inline: true });
  if (fabricatorInput.rank != null) fields.push({ name: '📊 Rank',  value: `#${fabricatorInput.rank}`, inline: true });
  if (fabricatorInput.trend)        fields.push({ name: '📉 Trend', value: fabricatorInput.trend,        inline: true });

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `📊 ${trainerName}`,
      description: fans.lifetime != null
        ? `**Lifetime Fangain**  ·  ${fans.lifetime.toLocaleString('en-US')}`
        : '',
      thumbnail:   thumbnailUrl ? { url: thumbnailUrl } : undefined,
      fields:      fields.length > 0 ? fields : [{ name: 'Status', value: 'No data available.' }],
      footer:      { text: 'fanGain · UmaKraft' },
      timestamp:   meta.generatedAt ?? new Date().toISOString(),
    },
    interaction,
  };
}

/**
 * Fallback from Member directory when pipeline is down.
 */
function buildMemberFallbackEmbed(member, payload) {
  const { interaction } = payload;
  const fields = [];

  if (member.totalFans != null) fields.push({ name: 'Total Fans',  value: member.totalFans.toLocaleString('en-US'), inline: true });
  if (member.dailyGain != null) fields.push({ name: 'Daily Gain',  value: (member.dailyGain >= 0 ? '+' : '') + member.dailyGain.toLocaleString('en-US'), inline: true });
  if (member.weeklyGain != null)fields.push({ name: 'Weekly Gain', value: (member.weeklyGain >= 0 ? '+' : '') + member.weeklyGain.toLocaleString('en-US'), inline: true });
  if (member.monthlyGain != null)fields.push({ name: 'Monthly Gain',value: (member.monthlyGain >= 0 ? '+' : '') + member.monthlyGain.toLocaleString('en-US'), inline: true });
  if (member.status)              fields.push({ name: 'Status',      value: member.status,                                    inline: true });

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `📊 ${member.name}`,
      description: `⚠️ Served from Member directory — pipeline unavailable.`,
      fields,
      footer:      { text: `ID: ${member.id} · UmaKraft` },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fanGain(payload) {
  let result;
  try {
    result = await runImagePipeline({
      payload,
      blueprintKey: 'fanGain',
      embedBuilder: buildFanGainEmbed,
      mapToFabricator: (cp, options) => ({
        blueprintKey: 'fanGain',
        meta: {
          trainerId:   cp.id,
          trainerName: cp.name   ?? cp.id,
          avatarUrl:   cp.avatarUrl  ?? null,
          rank:        cp.rank ?? cp.metadata?.rank ?? null,
          generatedAt: new Date().toISOString(),
          circle:      parseCircleId(options.circle) ?? null,
        },
        fans: {
          lifetime: cp.fans          ?? 0,
          daily:    cp.dailyFanGain  ?? 0,
          weekly:   cp.weeklyFanGain ?? 0,
          monthly:  cp.monthlyFanGain ?? 0,
        },
        rank: cp.rank ?? null,
        trend: cp.trend ?? null,
        presentationHints: cp.presentationHints ?? {},
      }),
    });
  } catch (_pipelineErr) {
    result = { success: false, interaction: payload.interaction };
  }

  if (result?.success !== false) return result;

  // ── Fallback: read from /Member/active/ or /Member/inactive/ ─────────────
  const { interaction } = payload;
  const trainerName = interaction?.options?.getString?.('trainer') ?? '';

  if (!trainerName) {
    return {
      success:   false,
      type:      'embed',
      ephemeral: true,
      result: {
        title:       '⚠️ Fan Gain Unavailable',
        description: 'Pipeline failed and no trainer name was supplied to check the Member directory.',
      },
      interaction,
    };
  }

  try {
    const { readMember } = await import('../../../Member/memberReader.js');
    const member = readMember(null, trainerName);

    if (member) {
      console.log(`[fanGain] Served ${trainerName} from Member directory (pipeline unavailable)`);
      return buildMemberFallbackEmbed(member, payload);
    }

    return {
      success:   false,
      type:      'embed',
      ephemeral: true,
      result: {
        title:       '⚠️ Trainer Not Found',
        description: `\`${trainerName}\` was not found in the pipeline or the Member directory.`,
      },
      interaction,
    };
  } catch (memberErr) {
    return {
      success:   false,
      type:      'embed',
      ephemeral: true,
      result: {
        title:       '⚠️ Fan Gain Unavailable',
        description: `Pipeline and Member directory both failed. Try again later.`,
      },
      interaction,
    };
  }
}
