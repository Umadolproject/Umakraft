// Distribution/Coordinator/actions/fanGain.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

/**
 * Build a Discord embed from Member directory data (fallback).
 * Mirrors the structure of buildTrainerEmbed in pipelineImage.js.
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

export async function fanGain(payload) {
  // ── Try main pipeline ───────────────────────────────────────────────────
  let result;
  try {
    result = await runImagePipeline({
      payload,
      blueprintKey: 'fanGain',
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
        trend: cp.trend ?? null,
        presentationHints: cp.presentationHints ?? {},
      }),
    });
  } catch (_pipelineErr) {
    // Preserve interaction so the Dispatcher can reply to the user.
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
