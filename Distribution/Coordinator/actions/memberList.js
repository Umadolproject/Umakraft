// Distribution/Coordinator/actions/memberList.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

/**
 * Build a Discord embed from Member directory data (fallback).
 * Reads all active/ and inactive/ .md files and returns a member list.
 */
function buildMemberListFallback(members, formerMembers, payload) {
  const { interaction } = payload;
  const totalCount = members.length + (formerMembers?.length ?? 0);

  const activeLines = members.length === 0
    ? '*No active members found.*'
    : members.map(m =>
        `**${m.name}** — ${(m.totalFans ?? 0).toLocaleString('en-US')} fans` +
        ` · Daily +${(m.dailyGain ?? 0).toLocaleString('en-US')}` +
        ` · Monthly +${(m.monthlyGain ?? 0).toLocaleString('en-US')}`
      ).join('\n');

  const formerLines = (!formerMembers || formerMembers.length === 0)
    ? ''
    : '\n\n**Former Members (LEFT):**\n' +
      formerMembers.map(m =>
        `~~${m.name}~~ — ${(m.totalFans ?? 0).toLocaleString('en-US')} fans` +
        ` · Status: LEFT`
      ).join('\n');

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `👥 Circle Members — UmaKraft`,
      description: `${activeLines}${formerLines}`,
      footer:      { text: `⚠️ Served from Member directory · ${totalCount} total` },
      timestamp:   new Date().toISOString(),
    },
    interaction,
  };
}

export async function memberList(payload) {
  const { options, guildId, interaction } = payload;
  const includeFormer = options?.includeFormer ?? false;

  // ── Try main pipeline ───────────────────────────────────────────────────
  let result;
  try {
    result = await runRankingsPipeline({
      payload,
      rankingsParams: {
        type:          'memberList',
        circle:        parseCircleId(options.circle) ?? null,
        includeFormer,
      },
      blueprintKey: 'memberList',
      mapToFabricator: (cp, opts) => ({
        blueprintKey: 'memberList',
        meta: {
          circle:        parseCircleId(opts.circle) ?? null,
          includeFormer: opts.includeFormer ?? false,
          generatedAt:   new Date().toISOString(),
        },
        members:       cp.members       ?? [],
        formerMembers: cp.formerMembers ?? [],
        totalCount:    cp.totalCount    ?? 0,
        presentationHints: cp.presentationHints ?? {},
      }),
    });
  } catch (_pipelineErr) {
    result = { success: false };
  }

  if (result?.success !== false) return result;

  // ── Fallback: read from /Member/active/ and /Member/inactive/ ───────────
  try {
    const { readAllActive, readAllInactive } = await import(
      '../../../Member/memberReader.js'
    );

    const activeMembers  = readAllActive();
    const inactiveMembers = includeFormer ? readAllInactive() : [];

    console.log(
      `[memberList] Served from Member directory ` +
      `(${activeMembers.length} active, ${inactiveMembers.length} former)`
    );

    return buildMemberListFallback(activeMembers, inactiveMembers, payload);
  } catch (memberErr) {
    return {
      success:   false,
      type:      'embed',
      ephemeral: true,
      result: {
        title:       '⚠️ Member List Unavailable',
        description: `Pipeline and Member directory both failed: ${memberErr.message}`,
      },
      interaction,
    };
  }
}
