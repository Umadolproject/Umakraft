import * as archive from '../../../Broadcast/Archive/archive.js';
import * as archiveTransporter from '../../../Broadcast/archive_transporter/archiveTransporter.js';

export async function deadLetterReplay(payload) {
  const { interaction, options, client } = payload;
  const notificationKey = options.notificationKey;

  const replayResult = await archive.replayDeadLetter(notificationKey);
  if (!replayResult.success) {
    return {
      success: false,
      failedAt: 'Archive',
      error: replayResult.error ?? 'ARCHIVE_REPLAY_ERROR',
      message: replayResult.message ?? `Could not replay dead-letter key ${notificationKey}`,
      retriable: false,
      interaction,
    };
  }

  await archiveTransporter.fetch(notificationKey, client);

  return {
    success: true,
    type: 'embed',
    ephemeral: true,
    result: {
      title: '🔁 Dead-letter replay requested',
      description: `Replay was requested for \`${notificationKey}\` and the record was handed back to Archive-Transporter.`,
      fields: [
        { name: 'Notification Key', value: notificationKey, inline: false },
        { name: 'Status', value: 'Replay triggered', inline: true },
      ],
    },
    interaction,
  };
}
