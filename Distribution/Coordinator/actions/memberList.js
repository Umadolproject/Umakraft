// Distribution/Coordinator/actions/memberList.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';

export async function memberList(payload) {
  const { options, guildId } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      type:          'memberList',
      circle:        options.circle        ?? guildId,
      includeFormer: options.includeFormer ?? false,
    },
    blueprintKey: 'memberList',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'memberList',
      meta: {
        circle:        opts.circle        ?? null,
        includeFormer: opts.includeFormer ?? false,
        generatedAt:   new Date().toISOString(),
      },
      members:       cp.members       ?? [],
      formerMembers: cp.formerMembers ?? [],
      totalCount:    cp.totalCount    ?? 0,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
