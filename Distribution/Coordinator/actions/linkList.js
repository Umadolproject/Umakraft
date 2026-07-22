// Distribution/Coordinator/actions/linkList.js
// Returns a paginated image of all linked members in this guild.

import { runRankingsPipeline } from '../utils/pipelineImage.js';

export async function linkList(payload) {
  const { options, guildId } = payload;

  // TODO: Query member_links WHERE guild_id = guildId ORDER BY linked_at DESC
  //       LIMIT 20 OFFSET ($page - 1) * 20
  // Then pass the result to runRankingsPipeline with blueprintKey 'linkList'.

  return runRankingsPipeline({
    payload,
    rankingsParams: {
      type:    'linkList',
      guildId,
      page:    options.page ?? 1,
    },
    blueprintKey: 'linkList',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'linkList',
      meta: {
        guildId,
        page:        opts.page ?? 1,
        generatedAt: new Date().toISOString(),
      },
      entries:    cp.entries    ?? [],
      totalPages: cp.totalPages ?? 1,
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
