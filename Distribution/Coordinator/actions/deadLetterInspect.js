import * as archive from '../../../Broadcast/Archive/archive.js';
import { pipelineRuntime } from '../../../core/pipelineRuntime.js';

export async function deadLetterInspect(payload) {
  const { interaction, options } = payload;
  const notificationKey = options.notificationKey ?? null;
  const limit = Math.max(1, Math.min(options.limit ?? pipelineRuntime.broadcastDeadLetterInspectLimit, 20));

  if (notificationKey) {
    const recordResult = await archive.get(notificationKey);
    if (!recordResult.record) {
      return {
        success: false,
        failedAt: 'Archive',
        error: 'ARCHIVE_NOT_FOUND',
        message: `No Archive record found for key ${notificationKey}`,
        retriable: false,
        interaction,
      };
    }

    const record = recordResult.record;
    const history = await archive.getHistory(notificationKey);
    const attempts = await archive.getAttemptSummary(notificationKey);

    return {
      success: true,
      type: 'embed',
      ephemeral: true,
      result: {
        title: '🧾 Dead-letter inspection',
        description: `Inspection for \`${notificationKey}\``,
        fields: [
          { name: 'Type', value: record.type ?? 'n/a', inline: true },
          { name: 'Circle', value: record.circleId ?? 'n/a', inline: true },
          { name: 'Dead-letter', value: record.deadLetter ? 'true' : 'false', inline: true },
          { name: 'Reason', value: record.deadLetterReason ?? 'n/a', inline: false },
          { name: 'Attempts', value: String(attempts.failureCount ?? 0), inline: true },
          { name: 'Claimed At', value: record.claimedAt ?? 'n/a', inline: true },
          {
            name: 'Recent History',
            value: (history.history ?? []).slice(0, 5).map(item => `• ${item.attemptedAt} — ${item.step} — ${item.outcome}`).join('\n') || 'No history',
            inline: false,
          },
        ],
      },
      interaction,
    };
  }

  const listResult = await archive.listDeadLetters({ limit });
  const records = listResult.records ?? [];
  return {
    success: true,
    type: 'embed',
    ephemeral: true,
    result: {
      title: '🧾 Dead-letter queue',
      description: records.length > 0
        ? `Showing the ${records.length} most recent dead-letter records.`
        : 'No dead-letter records found.',
      fields: records.length > 0
        ? records.slice(0, 10).map(record => ({
            name: record.notificationKey,
            value: `type=${record.type} • circle=${record.circleId} • reason=${record.deadLetterReason ?? 'n/a'}`,
            inline: false,
          }))
        : [],
    },
    interaction,
  };
}
