// Distribution/Coordinator/actions/clubGain.js
import { runRankingsPipeline } from '../utils/pipelineImage.js';

export async function clubGain(payload) {
  const { options, guildId } = payload;
  return runRankingsPipeline({
    payload,
    rankingsParams: {
      type:  'clubGain',
      club:  options.club  ?? null,
      days:  options.days  ?? 30,
      guildId,
    },
    blueprintKey: 'clubGain',
    mapToFabricator: (cp, opts) => ({
      blueprintKey: 'clubGain',
      meta: {
        club:        cp.clubName    ?? opts.club ?? null,
        days:        opts.days      ?? 30,
        generatedAt: new Date().toISOString(),
      },
      dailyEntries: cp.dailyEntries ?? [],
      totals:       cp.totals       ?? {},
      summary:      cp.summary      ?? {},
      presentationHints: cp.presentationHints ?? {},
    }),
  });
}
