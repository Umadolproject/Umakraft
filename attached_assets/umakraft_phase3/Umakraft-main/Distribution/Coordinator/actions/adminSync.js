// Distribution/Coordinator/actions/adminSync.js
// Triggers an immediate Umamoe data sync for all circles configured in this guild.

import { processTrainer } from '../../../umamoe/pipeline.js';

export async function adminSync(payload) {
  const { interaction, guildId } = payload;

  // TODO: 1. SELECT trainer_id FROM member_links WHERE guild_id = $guildId
  //       2. Run processTrainer(id) for each linked member (sequentially to respect rate limits)
  //       3. Return summary: active members synced, new members detected, members who left

  // For now, signal that the sync flow is wired but the guild member query isn't built.
  return {
    success:  true,
    type:     'embed',
    ephemeral: true,
    result: {
      title:       '🔄 Sync triggered',
      description: 'The sync pipeline is wired. Full guild-member enumeration requires the database layer to be built.\n\n`processTrainer()` is available and functional for individual trainer IDs.',
      fields: [
        { name: 'Guild ID',    value: guildId,                  inline: false },
        { name: 'Status',      value: 'Partial — DB pending',   inline: true  },
      ],
    },
    interaction,
  };
}
