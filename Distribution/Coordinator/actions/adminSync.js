// Distribution/Coordinator/actions/adminSync.js
// Triggers an immediate Umamoe data sync for all linked members in this guild.
//
// Flow:
//   1. Load all trainer IDs linked to this guild from member_links
//   2. Run processTrainer(id) for each, sequentially (respects rate limits)
//   3. Return a summary embed: synced, failed, skipped

import { processTrainer } from '../../../umamoe/pipeline.js';
import { listLinks }      from '../utils/memberLinks.js';

const INTER_TRAINER_DELAY_MS = Number.parseInt(
  process.env.ADMIN_SYNC_DELAY_MS ?? '500',
  10,
);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function adminSync(payload) {
  const { interaction, guildId } = payload;
  const { links, total } = await listLinks(guildId, { limit: 500 });

  if (total === 0) {
    return {
      success:  true,
      type:     'embed',
      ephemeral: true,
      result: {
        title:       '🔄 Sync complete',
        description: 'No members are linked in this guild yet. Use `/link` to connect Discord members to Uma.moe trainers.',
      },
      interaction,
    };
  }

  let synced  = 0;
  let failed  = 0;
  const failures = [];

  for (let i = 0; i < links.length; i++) {
    const { trainerId, trainerName } = links[i];
    const result = await processTrainer(trainerId);

    if (result.success) {
      synced++;
    } else {
      failed++;
      failures.push(`${trainerName} (${trainerId}): ${result.error ?? 'unknown error'}`);
    }

    if (i < links.length - 1) await sleep(INTER_TRAINER_DELAY_MS);
  }

  const fields = [
    { name: '✅ Synced',  value: String(synced),       inline: true },
    { name: '❌ Failed',  value: String(failed),       inline: true },
    { name: '👥 Total',   value: String(links.length), inline: true },
  ];

  if (failures.length > 0) {
    const failList = failures.map(f => `• ${f}`).join('\n');
    fields.push({
      name:  'Failed trainers',
      value: failList.length > 1000 ? `${failList.slice(0, 997)}…` : failList,
      inline: false,
    });
  }

  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       '🔄 Sync complete',
      description: failed === 0
        ? `All ${synced} linked trainer${synced !== 1 ? 's' : ''} refreshed successfully.`
        : `${synced} of ${links.length} trainer${links.length !== 1 ? 's' : ''} refreshed. ${failed} failed — check fields below.`,
      fields,
    },
    interaction,
  };
}
