// Distribution/Coordinator/actions/clubGain.js
import { processClubGain } from '../../../umamoe/pipeline.js';
import { produce, claimDeliverable } from '../../../Workshop/pipeline.js';
import { parseCircleId } from '../utils/parseCircle.js';
import { CONFIGURED_CIRCLES } from '../../../core/botConfig.js';

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

  const { clubId, clubName, rows, summary } = result.clubGain;

  const fabricatorInput = {
    blueprintKey: 'clubGain',
    meta: {
      clubId,
      clubName,
      periodDays: days,
      generatedAt: new Date().toISOString(),
    },
    rows,
    summary,
  };

  const produced = await produce(fabricatorInput);
  if (!produced.success) {
    return {
      success:   false,
      failedAt:  'Workshop',
      error:     produced.error ?? 'FABRICATOR_RENDER_ERROR',
      message:   produced.message ?? 'Workshop produce failed',
      retriable: false,
      interaction,
    };
  }

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
    blueprintKey: 'clubGain',
    png:          claimed.deliverable.png,
    meta:         claimed.deliverable.meta,
    interaction,
  };
}
